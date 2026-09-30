<?php

namespace App\GraphQL\Queries;

use App\Enums\TreeRole;
use App\GraphQL\Support\BaseQuery;
use App\Models\Delegation;
use App\Services\Trees\TreeAccess;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;

/** Передачи веток из этого древа (для владельца). */
class DelegationsQuery extends BaseQuery
{
    protected $attributes = ['name' => 'delegations', 'description' => 'Ветки древа, переданные родственникам'];

    public function type(): Type
    {
        return Type::nonNull(Type::listOf(Type::nonNull(GraphQL::type('Delegation'))));
    }

    public function args(): array
    {
        return ['treeId' => ['type' => Type::nonNull(Type::id())]];
    }

    public function resolve($root, array $args, $ctx, TreeAccess $access)
    {
        $tree = $access->require($this->user(), $args['treeId'], TreeRole::Viewer);

        return Delegation::where('source_tree_id', $tree->id)->with('targetUser')->latest()->get();
    }
}
