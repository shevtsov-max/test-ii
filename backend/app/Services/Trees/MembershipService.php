<?php

namespace App\Services\Trees;

use App\Enums\MemberStatus;
use App\Enums\TreeRole;
use App\GraphQL\Support\ApiError;
use App\Mail\TreeInvitationMail;
use App\Models\Tree;
use App\Models\TreeMember;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/** Совместный доступ к древу: приглашение по почте, принятие по ссылке, роли. */
final class MembershipService
{
    public function invite(Tree $tree, User $by, string $email, TreeRole $role): TreeMember
    {
        $email = mb_strtolower(trim($email));
        if ($role === TreeRole::Owner) {
            throw ApiError::validation('Владелец у древа один');
        }
        if (mb_strtolower($tree->owner->email) === $email) {
            throw ApiError::validation('Это ваш адрес — вы уже владелец древа');
        }
        $existing = TreeMember::where('tree_id', $tree->id)
            ->where(fn ($q) => $q->where('invited_email', $email)->orWhereHas('user', fn ($u) => $u->where('email', $email)))
            ->first();
        if ($existing?->status === MemberStatus::Active) {
            throw ApiError::conflict('У этого человека уже есть доступ к древу');
        }

        $token = 'm'.Str::random(40);
        $member = $existing ?? new TreeMember(['tree_id' => $tree->id]);
        $member->fill([
            'invited_email' => $email,
            'role' => $role,
            'status' => MemberStatus::Pending,
            'token_hash' => hash('sha256', $token),
            'invited_by' => $by->id,
        ])->save();

        Mail::to($email)->queue(new TreeInvitationMail(
            inviter: $by->name,
            treeName: $tree->name,
            role: $role->label(),
            link: config('rodoslovnaya.frontend_url').'/#/invite/'.$token,
        ));

        return $member;
    }

    public function findByToken(string $token): ?TreeMember
    {
        return TreeMember::where('token_hash', hash('sha256', $token))->first();
    }

    public function accept(TreeMember $member, User $user): Tree
    {
        if ($member->status !== MemberStatus::Pending) {
            throw ApiError::conflict('Приглашение уже принято');
        }
        if ($member->invited_email && mb_strtolower($user->email) !== $member->invited_email) {
            throw ApiError::forbidden('Приглашение отправлено на другую почту — войдите с тем адресом, на который пришло письмо');
        }
        if ($member->tree->owner_id === $user->id) {
            throw ApiError::validation('Вы владелец этого древа');
        }
        // Уже участник по другому приглашению — оставляем одну запись
        TreeMember::where('tree_id', $member->tree_id)->where('user_id', $user->id)->where('id', '!=', $member->id)->delete();
        $member->update([
            'user_id' => $user->id,
            'status' => MemberStatus::Active,
            'token_hash' => null,
            'accepted_at' => now(),
        ]);

        return $member->tree;
    }

    /** @return list<array> для GraphQL-типа TreeMember */
    public function list(Tree $tree): array
    {
        $owner = $tree->owner;
        $out = [[
            'id' => 'owner-'.$tree->id,
            'role' => TreeRole::Owner->value,
            'user' => $owner,
            'invitedEmail' => null,
            'status' => MemberStatus::Active->value,
            'createdAt' => $tree->created_at,
        ]];
        foreach ($tree->members()->with('user')->orderBy('created_at')->get() as $m) {
            $out[] = [
                'id' => $m->id,
                'role' => $m->role->value,
                'user' => $m->user,
                'invitedEmail' => $m->invited_email,
                'status' => $m->status->value,
                'createdAt' => $m->created_at,
            ];
        }

        return $out;
    }
}
