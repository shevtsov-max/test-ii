<?php

namespace App\GraphQL\Mutations;

use App\Enums\TreeRole;
use App\GraphQL\Support\BaseMutation;
use App\GraphQL\Support\Throttle;
use App\Services\Delegations\DelegationService;
use App\Services\Trees\TreeAccess;
use GraphQL\Type\Definition\Type;
use Rebing\GraphQL\Support\Facades\GraphQL;

/** Передать ветку (персона + потомки) родственнику: письмо на почту и/или ссылка. */
class CreateDelegationMutation extends BaseMutation
{
    protected $attributes = ['name' => 'createDelegation', 'description' => 'Передать ветку родственнику'];

    public function type(): Type
    {
        return Type::nonNull(GraphQL::type('CreateDelegationResult'));
    }

    public function args(): array
    {
        return [
            'treeId' => ['type' => Type::nonNull(Type::id())],
            'rootPersonId' => ['type' => Type::nonNull(Type::id())],
            'email' => ['type' => Type::string(), 'description' => 'Если указана — отправим письмо'],
            'message' => ['type' => Type::string()],
        ];
    }

    protected function rules(array $args = []): array
    {
        return [
            'email' => ['nullable', 'email:rfc', 'max:190'],
            'message' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function resolve($root, array $args, $ctx, TreeAccess $access, DelegationService $delegations): array
    {
        $user = $this->user();
        $tree = $access->require($user, $args['treeId'], TreeRole::Owner);
        Throttle::hit('delegate:'.$user->id, 30, 3600);
        [$d, $link] = $delegations->create($tree, $user, $args['rootPersonId'], $args['email'] ?? null, $args['message'] ?? null);

        return ['delegation' => $d, 'link' => $link];
    }
}
