<?php

namespace App\GraphQL\Queries;

use App\GraphQL\Support\BaseQuery;
use App\Services\Trees\MembershipService;
use App\Services\Trees\TreeAccess;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;

class TreeMembersQuery extends BaseQuery
{
    protected $attributes = ['name' => 'treeMembers', 'description' => 'Владелец и участники древа'];

    public function type(): Type
    {
        return Type::nonNull(Type::listOf(Type::nonNull(GraphQL::type('TreeMember'))));
    }

    public function args(): array
    {
        return ['treeId' => ['type' => Type::nonNull(Type::id())]];
    }

    public function resolve($root, array $args, $ctx, TreeAccess $access, MembershipService $members): array
    {
        return $members->list($access->require($this->user(), $args['treeId']));
    }
}
