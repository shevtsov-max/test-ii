<?php

namespace Tests\Feature;

use App\Mail\TreeInvitationMail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class TreesTest extends TestCase
{
    use RefreshDatabase;

    private const TREE = 'query($id: ID!) { tree(id: $id) { id name version role homePersonId persons { id firstName lastName gender living custom birth { date { year qualifier } } } families { id partners children childLinks } places { id name } } }';

    private const APPLY = 'mutation($id: ID!, $c: TreeChangesInput!) { applyTreeChanges(treeId: $id, changes: $c) { version } }';

    private function createTree(string $token): string
    {
        return $this->gqlData('mutation($i: CreateTreeInput!) { createTree(input: $i) { id persons homeName } }', [
            'i' => ['name' => 'Орловы', 'data' => $this->sampleTreeData()],
        ], $token)['createTree']['id'];
    }

    public function test_create_and_read_tree_with_normalized_data(): void
    {
        [, $token] = $this->login();
        $summary = $this->gqlData('mutation($i: CreateTreeInput!) { createTree(input: $i) { id persons families homeName role } }', [
            'i' => ['name' => 'Орловы', 'data' => $this->sampleTreeData()],
        ], $token)['createTree'];
        $this->assertSame(8, $summary['persons']);
        $this->assertSame('Алексей Орлов', $summary['homeName']);
        $this->assertSame('owner', $summary['role']);

        $tree = $this->gqlData(self::TREE, ['id' => $summary['id']], $token)['tree'];
        $this->assertSame('me', $tree['homePersonId']);
        $me = collect($tree['persons'])->firstWhere('id', 'me');
        $this->assertSame(1985, $me['birth']['date']['year']);
        $this->assertSame('exact', $me['birth']['date']['qualifier']);
        // Словари отдаются объектами, даже пустые
        $raw = $this->graphql(self::TREE, ['id' => $summary['id']], $token)->getContent();
        $this->assertStringContainsString('"custom":{}', $raw);
        $this->assertStringContainsString('"childLinks":{}', $raw);

        $list = $this->gqlData('{ trees { id name persons } }', [], $token)['trees'];
        $this->assertCount(1, $list);
    }

    public function test_apply_changes_upserts_deletes_and_bumps_version(): void
    {
        [, $token] = $this->login();
        $id = $this->createTree($token);
        $v0 = $this->gqlData(self::TREE, ['id' => $id], $token)['tree']['version'];

        $person = ['id' => 'baby', 'gender' => 'F', 'firstName' => 'София', 'lastName' => 'Орлова', 'unknownField' => 'x'];
        $v1 = $this->gqlData(self::APPLY, ['id' => $id, 'c' => [
            'baseVersion' => $v0,
            'upsertPersons' => [$person],
            'deletePersons' => ['cousin'],
            'tree' => ['name' => 'Орловы и Лебедевы'],
        ]], $token)['applyTreeChanges']['version'];
        $this->assertGreaterThan($v0, $v1);

        $tree = $this->gqlData(self::TREE, ['id' => $id], $token)['tree'];
        $this->assertSame('Орловы и Лебедевы', $tree['name']);
        $ids = array_column($tree['persons'], 'id');
        $this->assertContains('baby', $ids);
        $this->assertNotContains('cousin', $ids);
    }

    public function test_conflict_only_when_same_entity_changed_after_base_version(): void
    {
        [, $token] = $this->login();
        $id = $this->createTree($token);
        $v0 = $this->gqlData(self::TREE, ['id' => $id], $token)['tree']['version'];
        $edit = fn ($pid, $name) => ['id' => $pid, 'gender' => 'M', 'firstName' => $name, 'lastName' => 'Орлов'];

        // Первый участник меняет «fa»
        $this->gqlData(self::APPLY, ['id' => $id, 'c' => ['baseVersion' => $v0, 'upsertPersons' => [$edit('fa', 'Сергей Н.')]]], $token);
        // Второй — от старой версии меняет другую запись: конфликта нет
        $this->gqlData(self::APPLY, ['id' => $id, 'c' => ['baseVersion' => $v0, 'upsertPersons' => [$edit('uncle', 'Виктор Н.')]]], $token);
        // …а ту же — конфликт
        $this->assertSame('CONFLICT', $this->gqlErrorCode(self::APPLY, ['id' => $id, 'c' => ['baseVersion' => $v0, 'upsertPersons' => [$edit('fa', 'Другое')]]], $token));
    }

    public function test_invalid_ids_are_rejected(): void
    {
        [, $token] = $this->login();
        $id = $this->createTree($token);
        $code = $this->gqlErrorCode(self::APPLY, ['id' => $id, 'c' => ['upsertPersons' => [['id' => '../etc/passwd', 'firstName' => 'x']]]], $token);
        $this->assertSame('VALIDATION', $code);
    }

    public function test_other_users_cannot_see_or_edit(): void
    {
        [, $owner] = $this->login();
        [, $stranger] = $this->login();
        $id = $this->createTree($owner);
        $this->assertSame('NOT_FOUND', $this->gqlErrorCode(self::TREE, ['id' => $id], $stranger));
        $this->assertSame('NOT_FOUND', $this->gqlErrorCode(self::APPLY, ['id' => $id, 'c' => ['deletePersons' => ['me']]], $stranger));
    }

    public function test_member_invitation_roles(): void
    {
        Mail::fake();
        [, $owner] = $this->login();
        $guest = User::factory()->create(['email' => 'viewer@example.com']);
        [, $guestToken] = $this->login($guest);
        $id = $this->createTree($owner);

        $this->gqlData('mutation($id: ID!) { inviteMember(treeId: $id, email: "viewer@example.com", role: viewer) { id status } }', ['id' => $id], $owner);
        $link = null;
        Mail::assertQueued(TreeInvitationMail::class, function ($m) use (&$link) {
            $link = $m->link;

            return true;
        });
        $token = substr($link, strrpos($link, '/') + 1);

        $info = $this->gqlData('query($t: String!) { invitation(token: $t) { kind treeName role email status } }', ['t' => $token])['invitation'];
        $this->assertSame(['kind' => 'member', 'treeName' => 'Орловы', 'role' => 'viewer', 'email' => 'vi••••@example.com', 'status' => 'pending'], $info);

        $this->gqlData('mutation($t: String!) { acceptInvitation(token: $t) { kind treeId } }', ['t' => $token], $guestToken);
        $tree = $this->gqlData(self::TREE, ['id' => $id], $guestToken)['tree'];
        $this->assertSame('viewer', $tree['role']);
        $this->assertSame('FORBIDDEN', $this->gqlErrorCode(self::APPLY, ['id' => $id, 'c' => ['deletePersons' => ['me']]], $guestToken));
        $this->assertCount(1, $this->gqlData('{ trees { id role } }', [], $guestToken)['trees']);
    }

    public function test_delete_tree_only_by_owner(): void
    {
        [, $token] = $this->login();
        $id = $this->createTree($token);
        $this->gqlData('mutation($id: ID!) { deleteTree(id: $id) }', ['id' => $id], $token);
        $this->assertDatabaseCount('tree_persons', 0);
    }
}
