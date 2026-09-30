<?php

namespace App\GraphQL\Queries;

use App\Domain\TreeJson;
use App\GraphQL\Support\BaseQuery;
use App\Services\Delegations\DelegationService;
use App\Services\Trees\TreeAccess;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;

/** Актуальные данные переданных веток — фронтенд подставляет их в древо только для просмотра. */
class DelegatedBranchesQuery extends BaseQuery
{
    protected $attributes = ['name' => 'delegatedBranches', 'description' => 'Ветки из древ родственников (только просмотр)'];

    public function type(): Type
    {
        return Type::nonNull(Type::listOf(Type::nonNull(GraphQL::type('DelegatedBranch'))));
    }

    public function args(): array
    {
        return ['treeId' => ['type' => Type::nonNull(Type::id())]];
    }

    public function resolve($root, array $args, $ctx, TreeAccess $access, DelegationService $delegations): array
    {
        $tree = $access->require($this->user(), $args['treeId']);

        return array_map(fn ($b) => ['delegation' => $b['delegation'], 'data' => TreeJson::encode($b['data'])], $delegations->branches($tree));
    }
}
