<?php

namespace App\Services\Trees;

use App\Enums\MemberStatus;
use App\Enums\TreeRole;
use App\GraphQL\Support\ApiError;
use App\Models\Tree;
use App\Models\TreeMember;
use App\Models\User;

/** Кто что может в древе: владелец (trees.owner_id) или участник с ролью (tree_members). */
final class TreeAccess
{
    public function role(User $user, Tree $tree): ?TreeRole
    {
        if ($tree->owner_id === $user->id) {
            return TreeRole::Owner;
        }
        $member = TreeMember::where('tree_id', $tree->id)
            ->where('user_id', $user->id)
            ->where('status', MemberStatus::Active)
            ->first();

        return $member?->role;
    }

    /**
     * Найти древо и проверить права. Чужое древо без доступа выглядит как несуществующее —
     * по ответу нельзя узнать, есть ли древо с таким id.
     */
    public function require(User $user, string $treeId, TreeRole $min = TreeRole::Viewer): Tree
    {
        $tree = Tree::find($treeId);
        $role = $tree ? $this->role($user, $tree) : null;
        if (! $tree || ! $role) {
            throw ApiError::notFound('Древо не найдено');
        }
        if (! $role->atLeast($min)) {
            throw ApiError::forbidden(match ($min) {
                TreeRole::Owner => 'Это может только владелец древа',
                default => 'У вас доступ только для просмотра',
            });
        }

        return $tree;
    }
}
