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

class RevokeDelegationMutation extends BaseMutation
{
    protected $attributes = ['name' => 'revokeDelegation', 'description' => 'Отозвать непринятое приглашение продолжить ветку'];

    public function type(): Type
    {
        return Type::nonNull(GraphQL::type('Delegation'));
    }

    public function args(): array
    {
        return ['id' => ['type' => Type::nonNull(Type::id())]];
    }

    public function resolve($root, array $args, $ctx, TreeAccess $access, DelegationService $delegations): Delegation
    {
        $d = Delegation::find($args['id']) ?? throw ApiError::notFound('Передача не найдена');
        $access->require($this->user(), $d->source_tree_id, TreeRole::Owner);
        $delegations->revoke($d);

        return $d->fresh();
    }
}
