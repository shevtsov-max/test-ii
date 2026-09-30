<?php

namespace App\GraphQL\Mutations;

use App\Enums\TreeRole;
use App\GraphQL\Support\ApiError;
use App\GraphQL\Support\BaseMutation;
use App\Models\TreeMember;
use App\Services\Trees\TreeAccess;
use GraphQL\Type\Definition\Type;

/** Закрыть доступ участнику (владелец) или выйти из чужого древа (сам участник). */
class RemoveMemberMutation extends BaseMutation
{
    protected $attributes = ['name' => 'removeMember', 'description' => 'Закрыть доступ к древу'];

    public function type(): Type
    {
        return Type::nonNull(Type::boolean());
    }

    public function args(): array
    {
        return ['memberId' => ['type' => Type::nonNull(Type::id())]];
    }

    public function resolve($root, array $args, $ctx, TreeAccess $access): bool
    {
        $user = $this->user();
        $m = TreeMember::find($args['memberId']) ?? throw ApiError::notFound('Участник не найден');
        if ($m->user_id !== $user->id) {
            $access->require($user, $m->tree_id, TreeRole::Owner);
        }
        $m->delete();

        return true;
    }
}
