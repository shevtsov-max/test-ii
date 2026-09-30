<?php

namespace App\Services\Delegations;

use App\Domain\Branch;
use App\Domain\Names;
use App\Enums\DelegationStatus;
use App\GraphQL\Support\ApiError;
use App\Mail\DelegationInvitationMail;
use App\Models\Delegation;
use App\Models\Tree;
use App\Models\User;
use App\Services\Media\MediaStorage;
use App\Services\Trees\TreeRepository;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * Делегирование ветки родственнику.
 *
 *  1. Владелец древа выбирает персону → create(): приглашение по почте или ссылкой (status = pending).
 *  2. Родственник открывает ссылку, входит или регистрируется → accept(): у него появляется своё древо
 *     с копией ветки (персона, потомки, их супруги, родители персоны для контекста). status = active.
 *  3. В древе владельца ветка закрыта для правки (lockedPersonIds) и показывается из древа родственника
 *     (branches) — только для просмотра, со всеми его изменениями.
 *  4. Владелец может склонировать текущую ветку себе → cloneToSource(): копия становится обычной частью
 *     его древа, связь завершается (status = cloned). Древо родственника при этом не меняется.
 */
final class DelegationService
{
    private const MAX_DEPTH = 5;

    public function __construct(
        private readonly TreeRepository $trees,
        private readonly MediaStorage $media,
    ) {}

    /** @return array{0: Delegation, 1: string} делегирование и ссылка-приглашение */
    public function create(Tree $source, User $by, string $rootId, ?string $email, ?string $message): array
    {
        $data = $this->trees->load($source, ['persons', 'families']);
        if (! isset($data['persons'][$rootId])) {
            throw ApiError::notFound('Персона не найдена');
        }
        $branch = Branch::personIds($data, $rootId);
        foreach ($source->delegations()->whereIn('status', [DelegationStatus::Pending, DelegationStatus::Active])->get() as $d) {
            $taken = $d->status === DelegationStatus::Active ? $d->person_ids : Branch::personIds($data, $d->root_person_id);
            if (array_intersect($branch, $taken ?? [])) {
                throw ApiError::conflict('Часть этой ветки уже передана или ждёт ответа на приглашение');
            }
        }

        $token = 'd'.Str::random(40);
        $delegation = Delegation::create([
            'source_tree_id' => $source->id,
            'root_person_id' => $rootId,
            'created_by' => $by->id,
            'invitee_email' => $email ? mb_strtolower(trim($email)) : null,
            'message' => $message ? mb_substr(trim($message), 0, 2000) : null,
            'token_hash' => hash('sha256', $token),
            'token_encrypted' => Crypt::encryptString($token),
            'status' => DelegationStatus::Pending,
            'expires_at' => now()->addDays(config('rodoslovnaya.invitations.ttl_days')),
        ]);
        $link = $this->linkFor($token);
        if ($delegation->invitee_email) {
            Mail::to($delegation->invitee_email)->queue(new DelegationInvitationMail(
                inviter: $by->name,
                treeName: $source->name,
                rootName: Names::formal($data['persons'][$rootId]),
                persons: count($branch),
                message: $delegation->message,
                link: $link,
            ));
        }

        return [$delegation, $link];
    }

    /** Ссылка-приглашение (пока приглашение не принято). */
    public function link(Delegation $d): ?string
    {
        if ($d->status !== DelegationStatus::Pending || ! $d->token_encrypted) {
            return null;
        }

        return $this->linkFor(Crypt::decryptString($d->token_encrypted));
    }

    public function findByToken(string $token): ?Delegation
    {
        return Delegation::where('token_hash', hash('sha256', $token))->first();
    }

    /** Родственник принимает ветку: создаётся его древо. */
    public function accept(Delegation $d, User $user): Tree
    {
        $this->assertAcceptable($d, $user);

        return DB::transaction(function () use ($d, $user) {
            $source = Tree::whereKey($d->source_tree_id)->lockForUpdate()->firstOrFail();
            $data = $this->trees->load($source);
            if (! isset($data['persons'][$d->root_person_id])) {
                throw ApiError::notFound('Персона, с которой начинается ветка, удалена из древа');
            }
            $branch = Branch::extract($data, $d->root_person_id, withParents: true);
            $root = $data['persons'][$d->root_person_id];
            $branch['homePersonId'] = $d->root_person_id;
            $branch['customFields'] = $source->custom_fields;

            $target = $this->trees->create(
                $user,
                'Ветка: '.Names::formal($root),
                "Передана из древа «{$source->name}» ({$d->creator->name}). Ветка начинается с персоны {$root['firstName']} {$root['lastName']}.",
                $this->withCopiedFiles($branch, null),
            );
            // Файлы ветки копируются в древо родственника: у каждого древа свои файлы
            $this->copyMediaFiles($target);

            $d->update([
                'status' => DelegationStatus::Active,
                'person_ids' => Branch::personIds($data, $d->root_person_id),
                'target_tree_id' => $target->id,
                'target_user_id' => $user->id,
                'accepted_at' => now(),
                'token_hash' => null,
                'token_encrypted' => null,
            ]);
            // Правки ветки в исходном древе больше невозможны — отметим новую версию, чтобы клиенты перечитали древо
            $source->version = $this->trees->nextVersion($source->version);
            $source->save();

            return $target;
        });
    }

    public function decline(Delegation $d): void
    {
        if ($d->status !== DelegationStatus::Pending) {
            throw ApiError::conflict('Приглашение уже неактуально');
        }
        $d->update(['status' => DelegationStatus::Declined, 'ended_at' => now(), 'token_hash' => null, 'token_encrypted' => null]);
    }

    public function revoke(Delegation $d): void
    {
        if ($d->status !== DelegationStatus::Pending) {
            throw ApiError::conflict('Принятую передачу нельзя отозвать — склонируйте ветку себе');
        }
        $d->update(['status' => DelegationStatus::Revoked, 'ended_at' => now(), 'token_hash' => null, 'token_encrypted' => null]);
    }

    /**
     * Персоны древа, закрытые для правки (переданы родственникам).
     *
     * @return list<string>
     */
    public function lockedPersonIds(Tree $tree): array
    {
        $out = [];
        foreach (Delegation::where('source_tree_id', $tree->id)->where('status', DelegationStatus::Active)->get(['person_ids']) as $d) {
            array_push($out, ...($d->person_ids ?? []));
        }

        return array_values(array_unique($out));
    }

    /**
     * Актуальные ветки из древ родственников — для показа в исходном древе.
     *
     * @return list<array{delegation: Delegation, data: array}>
     */
    public function branches(Tree $source, int $depth = 0): array
    {
        $out = [];
        $active = Delegation::where('source_tree_id', $source->id)->where('status', DelegationStatus::Active)->with('targetTree', 'targetUser')->get();
        foreach ($active as $d) {
            $data = $this->currentBranch($d, $depth);
            if ($data !== null) {
                $out[] = ['delegation' => $d, 'data' => $data];
            }
        }

        return $out;
    }

    /**
     * Скопировать ветку из древа родственника в исходное древо (владелец «клонирует к себе»).
     * Древо родственника не меняется; связь завершается.
     *
     * @return array{version: int, updatedAt: \DateTimeInterface}
     */
    public function cloneToSource(Delegation $d, DelegationStatus $finalStatus = DelegationStatus::Cloned): array
    {
        if ($d->status !== DelegationStatus::Active) {
            throw ApiError::conflict('Ветка не передана — копировать нечего');
        }

        return DB::transaction(function () use ($d, $finalStatus) {
            $source = Tree::whereKey($d->source_tree_id)->lockForUpdate()->firstOrFail();
            $branch = $this->currentBranch($d, 0);
            $version = $this->trees->nextVersion($source->version);

            if ($branch && isset($branch['persons'][$d->root_person_id])) {
                $old = $this->trees->load($source, ['persons', 'families']);
                $lockedFamilies = Branch::familyIds($old, $d->person_ids ?? []);
                DB::table('tree_persons')->where('tree_id', $source->id)->whereIn('id', $d->person_ids ?? [])->delete();
                DB::table('tree_families')->where('tree_id', $source->id)->whereIn('id', $lockedFamilies)->delete();

                $branch = $this->withCopiedFiles($branch, $source);
                foreach (TreeRepository::TABLES as $collection => $table) {
                    $this->trees->upsertRows($source, $table, $branch[$collection] ?? [], $version);
                }
            }
            // Если родственник удалил начальную персону — остаётся копия, сохранённая при передаче

            $d->update(['status' => $finalStatus, 'ended_at' => now()]);
            $source->version = $version;
            $this->trees->refreshSummary($source);
            $source->save();

            return ['version' => $source->version, 'updatedAt' => $source->updated_at];
        });
    }

    /**
     * Перед удалением древа: ветки, которые в нём продолжали, возвращаются владельцам исходных древ.
     */
    public function beforeTreeDeleted(Tree $tree): void
    {
        foreach (Delegation::where('target_tree_id', $tree->id)->where('status', DelegationStatus::Active)->get() as $d) {
            $this->cloneToSource($d, DelegationStatus::Ended);
        }
    }

    /** Может ли пользователь принять приглашение (проверки без побочных эффектов). */
    public function assertAcceptable(Delegation $d, User $user): void
    {
        if ($d->status !== DelegationStatus::Pending) {
            throw ApiError::conflict('Приглашение уже неактуально');
        }
        if ($d->expires_at->isPast()) {
            throw ApiError::conflict('Срок приглашения истёк — попросите прислать новое');
        }
        if ($d->created_by === $user->id) {
            throw ApiError::validation('Это ваше приглашение — отправьте ссылку родственнику');
        }
        if ($d->invitee_email && mb_strtolower($user->email) !== $d->invitee_email) {
            throw ApiError::forbidden("Приглашение отправлено на другую почту. Войдите с адресом {$this->maskEmail($d->invitee_email)}");
        }
    }

    public function maskEmail(?string $email): ?string
    {
        if (! $email || ! str_contains($email, '@')) {
            return null;
        }
        [$name, $domain] = explode('@', $email, 2);

        return mb_substr($name, 0, 2).str_repeat('•', max(1, mb_strlen($name) - 2)).'@'.$domain;
    }

    // ------------------------------------------------------------------ внутреннее

    private function linkFor(string $token): string
    {
        return config('rodoslovnaya.frontend_url').'/#/invite/'.$token;
    }

    /**
     * Текущая ветка из древа родственника (с учётом того, что он сам мог передать часть ветки дальше).
     */
    private function currentBranch(Delegation $d, int $depth): ?array
    {
        $target = $d->targetTree;
        if (! $target) {
            return null;
        }
        $data = $this->trees->load($target);
        if ($depth < self::MAX_DEPTH) {
            $data = $this->mergeBranches($data, $this->branches($target, $depth + 1));
        }
        if (! isset($data['persons'][$d->root_person_id])) {
            return null;
        }

        return Branch::extract($data, $d->root_person_id);
    }

    /** Подставить в данные древа актуальные ветки из древ родственников. */
    private function mergeBranches(array $data, array $branches): array
    {
        foreach ($branches as ['delegation' => $d, 'data' => $b]) {
            foreach (Branch::familyIds($data, $d->person_ids ?? []) as $fid) {
                unset($data['families'][$fid]);
            }
            foreach ($d->person_ids ?? [] as $pid) {
                unset($data['persons'][$pid]);
            }
            foreach (TreeRepository::TABLES as $collection => $_) {
                $data[$collection] = ($b[$collection] ?? []) + $data[$collection];
            }
        }

        return $data;
    }

    /** Файлы ветки → копии в древе-получателе (если оно уже есть). */
    private function withCopiedFiles(array $branch, ?Tree $target): array
    {
        if (! $target) {
            return $branch;
        }
        foreach ($branch['media'] ?? [] as $id => $m) {
            $branch['media'][$id]['src'] = $this->media->copyTo($m['src'] ?? null, $target);
            $branch['media'][$id]['thumb'] = $this->media->copyTo($m['thumb'] ?? null, $target);
        }

        return $branch;
    }

    /** После создания древа родственника скопировать файлы ветки в его папку. */
    private function copyMediaFiles(Tree $target): void
    {
        $data = $this->trees->load($target, ['media']);
        $copied = $this->withCopiedFiles(['media' => $data['media']], $target)['media'];
        $this->trees->upsertRows($target, 'tree_media', $copied, $target->version);
    }
}
