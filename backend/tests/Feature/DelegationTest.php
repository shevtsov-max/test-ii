<?php

namespace Tests\Feature;

use App\Mail\DelegationInvitationMail;
use App\Mail\TreeInvitationMail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Передача ветки родственнику: приглашение → своё древо у родственника → в исходном древе
 * ветка только для просмотра с его правками → клонирование себе.
 */
class DelegationTest extends TestCase
{
    use RefreshDatabase;

    private const APPLY = 'mutation($id: ID!, $c: TreeChangesInput!) { applyTreeChanges(treeId: $id, changes: $c) { version } }';

    public function test_full_delegation_cycle(): void
    {
        Mail::fake();
        [, $owner] = $this->login();
        [$relative, $relToken] = $this->login(User::factory()->create(['email' => 'denis@example.com']));
        $source = $this->gqlData('mutation($i: CreateTreeInput!) { createTree(input: $i) { id } }', ['i' => ['name' => 'Орловы', 'data' => $this->sampleTreeData()]], $owner)['createTree']['id'];

        // 1. Передаём ветку дяди (дядя + двоюродный брат)
        $created = $this->gqlData('mutation($t: ID!) { createDelegation(treeId: $t, rootPersonId: "uncle", email: "denis@example.com", message: "Продолжишь?") { link delegation { id status } } }', ['t' => $source], $owner)['createDelegation'];
        $this->assertSame('pending', $created['delegation']['status']);
        Mail::assertQueued(DelegationInvitationMail::class);
        $token = substr($created['link'], strrpos($created['link'], '/') + 1);

        $info = $this->gqlData('query($t: String!) { invitation(token: $t) { kind rootName persons message } }', ['t' => $token])['invitation'];
        $this->assertSame(['kind' => 'delegation', 'rootName' => 'Орлов Виктор', 'persons' => 2, 'message' => 'Продолжишь?'], $info);

        // Пока приглашение не принято — ветку можно править
        $this->gqlData(self::APPLY, ['id' => $source, 'c' => ['upsertPersons' => [['id' => 'uncle', 'gender' => 'M', 'firstName' => 'Виктор', 'lastName' => 'Орлов', 'middleName' => 'Петрович']]]], $owner);

        // Сам себе принять нельзя
        $this->assertSame('VALIDATION', $this->gqlErrorCode('mutation($t: String!) { acceptInvitation(token: $t) { treeId } }', ['t' => $token], $owner));

        // 2. Родственник принимает — у него своё древо с веткой и родителями корня для контекста
        $target = $this->gqlData('mutation($t: String!) { acceptInvitation(token: $t) { kind treeId } }', ['t' => $token], $relToken)['acceptInvitation']['treeId'];
        $targetTree = $this->gqlData('query($id: ID!) { tree(id: $id) { role homePersonId persons { id middleName } } }', ['id' => $target], $relToken)['tree'];
        $this->assertSame('owner', $targetTree['role']);
        $this->assertSame('uncle', $targetTree['homePersonId']);
        $this->assertEqualsCanonicalizing(['uncle', 'cousin', 'gf', 'gm'], array_column($targetTree['persons'], 'id'));

        // 3. В исходном древе ветка закрыта для правки
        $this->assertSame('FORBIDDEN', $this->gqlErrorCode(self::APPLY, ['id' => $source, 'c' => ['deletePersons' => ['cousin']]], $owner));
        $this->assertSame('FORBIDDEN', $this->gqlErrorCode(self::APPLY, ['id' => $source, 'c' => ['upsertFamilies' => [['id' => 'f3', 'partners' => ['uncle'], 'children' => []]]]], $owner));
        // Новый супруг у персоны из ветки — тоже правка ветки
        $this->assertSame('FORBIDDEN', $this->gqlErrorCode(self::APPLY, ['id' => $source, 'c' => [
            'upsertPersons' => [['id' => 'stranger', 'gender' => 'F', 'firstName' => 'Анна']],
            'upsertFamilies' => [['id' => 'f7', 'partners' => ['uncle', 'stranger'], 'children' => []]],
        ]], $owner));
        // Остальное древо — можно
        $this->gqlData(self::APPLY, ['id' => $source, 'c' => ['upsertPersons' => [['id' => 'me', 'gender' => 'M', 'firstName' => 'Алексей', 'lastName' => 'Орлов']]]], $owner);

        // 4. Родственник дополняет ветку — владелец видит это
        $this->gqlData(self::APPLY, ['id' => $target, 'c' => [
            'upsertPersons' => [['id' => 'grandkid', 'gender' => 'F', 'firstName' => 'Мила', 'lastName' => 'Орлова']],
            'upsertFamilies' => [['id' => 'f3', 'partners' => ['uncle'], 'children' => ['cousin']], ['id' => 'f9', 'partners' => ['cousin'], 'children' => ['grandkid']]],
        ]], $relToken);
        $branches = $this->gqlData('query($id: ID!) { delegatedBranches(treeId: $id) { delegation { status delegateName personIds } data } }', ['id' => $source], $owner)['delegatedBranches'];
        $this->assertCount(1, $branches);
        $this->assertSame('active', $branches[0]['delegation']['status']);
        $this->assertSame($relative->name, $branches[0]['delegation']['delegateName']);
        $this->assertEqualsCanonicalizing(['uncle', 'cousin'], $branches[0]['delegation']['personIds']);
        $this->assertEqualsCanonicalizing(['uncle', 'cousin', 'grandkid'], array_keys($branches[0]['data']['persons']));
        $this->assertArrayNotHasKey('gf', $branches[0]['data']['persons']);

        // 5. Владелец клонирует ветку себе: теперь это его данные, у родственника ничего не меняется
        $delegationId = $this->gqlData('query($id: ID!) { delegations(treeId: $id) { id } }', ['id' => $source], $owner)['delegations'][0]['id'];
        $this->gqlData('mutation($id: ID!) { cloneDelegation(id: $id) { version } }', ['id' => $delegationId], $owner);
        $sourcePersons = array_column($this->gqlData('query($id: ID!) { tree(id: $id) { persons { id } } }', ['id' => $source], $owner)['tree']['persons'], 'id');
        $this->assertContains('grandkid', $sourcePersons);
        $this->gqlData(self::APPLY, ['id' => $source, 'c' => ['deletePersons' => ['grandkid']]], $owner);
        $targetPersons = array_column($this->gqlData('query($id: ID!) { tree(id: $id) { persons { id } } }', ['id' => $target], $relToken)['tree']['persons'], 'id');
        $this->assertContains('grandkid', $targetPersons);
        $this->assertSame([], $this->gqlData('query($id: ID!) { delegatedBranches(treeId: $id) { data } }', ['id' => $source], $owner)['delegatedBranches']);
    }

    public function test_deleting_relatives_tree_returns_branch_to_owner(): void
    {
        [, $owner] = $this->login();
        [, $relToken] = $this->login();
        $source = $this->gqlData('mutation($i: CreateTreeInput!) { createTree(input: $i) { id } }', ['i' => ['name' => 'Орловы', 'data' => $this->sampleTreeData()]], $owner)['createTree']['id'];
        $link = $this->gqlData('mutation($t: ID!) { createDelegation(treeId: $t, rootPersonId: "uncle") { link } }', ['t' => $source], $owner)['createDelegation']['link'];
        $target = $this->gqlData('mutation($t: String!) { acceptInvitation(token: $t) { treeId } }', ['t' => substr($link, strrpos($link, '/') + 1)], $relToken)['acceptInvitation']['treeId'];
        $this->gqlData(self::APPLY, ['id' => $target, 'c' => ['upsertPersons' => [['id' => 'cousin', 'gender' => 'M', 'firstName' => 'Денис', 'lastName' => 'Орлов', 'occupation' => 'Инженер']]]], $relToken);

        $this->gqlData('mutation($id: ID!) { deleteTree(id: $id) }', ['id' => $target], $relToken);

        $status = $this->gqlData('query($id: ID!) { delegations(treeId: $id) { status } }', ['id' => $source], $owner)['delegations'][0]['status'];
        $this->assertSame('ended', $status);
        // Правки родственника сохранились у владельца, ветка снова редактируется
        $this->gqlData(self::APPLY, ['id' => $source, 'c' => ['deletePersons' => ['cousin']]], $owner);
    }

    public function test_only_owner_sees_invitation_link(): void
    {
        Mail::fake();
        [, $owner] = $this->login();
        [, $viewerToken] = $this->login(User::factory()->create(['email' => 'viewer@example.com']));
        $source = $this->gqlData('mutation($i: CreateTreeInput!) { createTree(input: $i) { id } }', ['i' => ['name' => 'Орловы', 'data' => $this->sampleTreeData()]], $owner)['createTree']['id'];
        $this->gqlData('mutation($id: ID!) { inviteMember(treeId: $id, email: "viewer@example.com", role: viewer) { id } }', ['id' => $source], $owner);
        $memberLink = null;
        Mail::assertQueued(TreeInvitationMail::class, function ($m) use (&$memberLink) {
            $memberLink = $m->link;

            return true;
        });
        $this->gqlData('mutation($t: String!) { acceptInvitation(token: $t) { treeId } }', ['t' => substr($memberLink, strrpos($memberLink, '/') + 1)], $viewerToken);
        $this->gqlData('mutation($t: ID!) { createDelegation(treeId: $t, rootPersonId: "uncle", email: "denis@example.com") { link } }', ['t' => $source], $owner);

        $asOwner = $this->gqlData('query($id: ID!) { delegations(treeId: $id) { link email } }', ['id' => $source], $owner)['delegations'][0];
        $this->assertNotNull($asOwner['link']);
        $this->assertSame('denis@example.com', $asOwner['email']);
        $asViewer = $this->gqlData('query($id: ID!) { delegations(treeId: $id) { link email } }', ['id' => $source], $viewerToken)['delegations'][0];
        $this->assertSame(['link' => null, 'email' => null], $asViewer);
    }

    public function test_overlapping_delegations_are_rejected(): void
    {
        [, $owner] = $this->login();
        $source = $this->gqlData('mutation($i: CreateTreeInput!) { createTree(input: $i) { id } }', ['i' => ['name' => 'Орловы', 'data' => $this->sampleTreeData()]], $owner)['createTree']['id'];
        $this->gqlData('mutation($t: ID!) { createDelegation(treeId: $t, rootPersonId: "uncle") { link } }', ['t' => $source], $owner);
        $this->assertSame('CONFLICT', $this->gqlErrorCode('mutation($t: ID!) { createDelegation(treeId: $t, rootPersonId: "cousin") { link } }', ['t' => $source], $owner));
    }
}
