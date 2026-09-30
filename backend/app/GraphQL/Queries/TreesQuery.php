<?php

namespace App\GraphQL\Queries;

use App\Enums\MemberStatus;
use App\GraphQL\Support\BaseQuery;
use App\Models\Tree;
use App\Services\Trees\TreeRepository;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;

/** Древа пользователя: свои и те, куда его пригласили. */
class TreesQuery extends BaseQuery
{
    protected $attributes = ['name' => 'trees', 'description' => 'Мои древа и древа, к которым открыт доступ'];

    public function type(): Type
    {
        return Type::nonNull(Type::listOf(Type::nonNull(GraphQL::type('TreeSummary'))));
    }

    public function resolve($root, array $args, $ctx, TreeRepository $repo): array
    {
        $user = $this->user();
        $roles = $user->memberships()->where('status', MemberStatus::Active)->pluck('role', 'tree_id');
        $trees = Tree::where('owner_id', $user->id)->orWhereIn('id', $roles->keys())->orderByDesc('updated_at')->get();

        return $trees->map(fn (Tree $t) => $repo->summary($t, $t->owner_id === $user->id ? 'owner' : $roles[$t->id]->value))->all();
    }
}
