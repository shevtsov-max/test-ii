<?php

namespace App\GraphQL\Queries;

use App\GraphQL\Support\BaseQuery;
use App\Services\Trees\TreeAccess;
use App\Services\Trees\TreeRepository;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;

/** Древо целиком (с ролью пользователя и версией для последующих сохранений). */
class TreeQuery extends BaseQuery
{
    protected $attributes = ['name' => 'tree', 'description' => 'Древо целиком'];

    public function type(): Type
    {
        return GraphQL::type('Tree');
    }

    public function args(): array
    {
        return ['id' => ['type' => Type::nonNull(Type::id())]];
    }

    public function resolve($root, array $args, $ctx, TreeAccess $access, TreeRepository $repo): array
    {
        $user = $this->user();
        $tree = $access->require($user, $args['id']);

        return $repo->forGraphQL($tree, $access->role($user, $tree)->value);
    }
}
