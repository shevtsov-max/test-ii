<?php

namespace App\GraphQL\Mutations;

use App\Enums\TreeRole;
use App\GraphQL\Support\BaseMutation;
use App\GraphQL\Support\Throttle;
use App\Services\Trees\MembershipService;
use App\Services\Trees\TreeAccess;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;

class InviteMemberMutation extends BaseMutation
{
    protected $attributes = ['name' => 'inviteMember', 'description' => 'Пригласить в древо по почте'];

    public function type(): Type
    {
        return Type::nonNull(GraphQL::type('TreeMember'));
    }

    public function args(): array
    {
        return [
            'treeId' => ['type' => Type::nonNull(Type::id())],
            'email' => ['type' => Type::nonNull(Type::string())],
            'role' => ['type' => Type::nonNull(GraphQL::type('TreeRole'))],
        ];
    }

    protected function rules(array $args = []): array
    {
        return ['email' => ['required', 'email:rfc', 'max:190']];
    }

    public function resolve($root, array $args, $ctx, TreeAccess $access, MembershipService $members): array
    {
        $user = $this->user();
        $tree = $access->require($user, $args['treeId'], TreeRole::Owner);
        Throttle::hit('invite:'.$user->id, 30, 3600);
        $m = $members->invite($tree, $user, $args['email'], TreeRole::from($args['role']));

        return ['id' => $m->id, 'role' => $m->role->value, 'user' => $m->user, 'invitedEmail' => $m->invited_email, 'status' => $m->status->value, 'createdAt' => $m->created_at];
    }
}
