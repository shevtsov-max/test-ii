<?php

namespace App\GraphQL\Mutations;

use App\Enums\TreeRole;
use App\GraphQL\Support\ApiError;
use App\GraphQL\Support\BaseMutation;
use App\Models\TreeMember;
use App\Services\Trees\TreeAccess;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;

class UpdateMemberMutation extends BaseMutation
{
    protected $attributes = ['name' => 'updateMember', 'description' => 'Изменить роль участника'];

    public function type(): Type
    {
        return Type::nonNull(GraphQL::type('TreeMember'));
    }

    public function args(): array
    {
        return [
            'memberId' => ['type' => Type::nonNull(Type::id())],
            'role' => ['type' => Type::nonNull(GraphQL::type('TreeRole'))],
        ];
    }

    public function resolve($root, array $args, $ctx, TreeAccess $access): array
    {
        $m = TreeMember::find($args['memberId']) ?? throw ApiError::notFound('Участник не найден');
        $access->require($this->user(), $m->tree_id, TreeRole::Owner);
        $role = TreeRole::from($args['role']);
        if ($role === TreeRole::Owner) {
            throw ApiError::validation('Владелец у древа один');
        }
        $m->update(['role' => $role]);

        return ['id' => $m->id, 'role' => $m->role->value, 'user' => $m->user, 'invitedEmail' => $m->invited_email, 'status' => $m->status->value, 'createdAt' => $m->created_at];
    }
}
