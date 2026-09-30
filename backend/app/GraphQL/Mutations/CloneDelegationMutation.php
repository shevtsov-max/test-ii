<?php

namespace App\GraphQL\Mutations;

use App\Enums\TreeRole;
use App\GraphQL\Support\ApiError;
use App\GraphQL\Support\BaseMutation;
use App\Models\Delegation;
use App\Services\Delegations\DelegationService;
use App\Services\Trees\TreeAccess;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;

/** Скопировать текущую ветку из древа родственника себе — дальше её можно править, у родственника ничего не меняется. */
class CloneDelegationMutation extends BaseMutation
{
    protected $attributes = ['name' => 'cloneDelegation', 'description' => 'Склонировать переданную ветку в своё древо'];

    public function type(): Type
    {
        return Type::nonNull(GraphQL::type('SaveResult'));
    }

    public function args(): array
    {
        return ['id' => ['type' => Type::nonNull(Type::id())]];
    }

    public function resolve($root, array $args, $ctx, TreeAccess $access, DelegationService $delegations): array
    {
        $d = Delegation::find($args['id']) ?? throw ApiError::notFound('Передача не найдена');
        $access->require($this->user(), $d->source_tree_id, TreeRole::Owner);

        return $delegations->cloneToSource($d);
    }
}
