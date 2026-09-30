<?php

namespace App\GraphQL\Mutations;

use App\Enums\TreeRole;
use App\GraphQL\Support\BaseMutation;
use App\Services\Delegations\DelegationService;
use App\Services\Trees\TreeAccess;
use App\Services\Trees\TreeRepository;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;

/**
 * Сохранение правок: только изменённые сущности (собираются из immer-патчей во frontend/src/api/changes.js).
 * Конфликт — только если ту же запись кто-то изменил после baseVersion.
 */
class ApplyTreeChangesMutation extends BaseMutation
{
    protected $attributes = ['name' => 'applyTreeChanges', 'description' => 'Сохранить изменения древа'];

    public function type(): Type
    {
        return Type::nonNull(GraphQL::type('SaveResult'));
    }

    public function args(): array
    {
        return [
            'treeId' => ['type' => Type::nonNull(Type::id())],
            'changes' => ['type' => Type::nonNull(GraphQL::type('TreeChangesInput'))],
        ];
    }

    public function resolve($root, array $args, $ctx, TreeAccess $access, TreeRepository $trees, DelegationService $delegations): array
    {
        $tree = $access->require($this->user(), $args['treeId'], TreeRole::Editor);

        return $trees->apply($tree, $args['changes'], $delegations);
    }
}
