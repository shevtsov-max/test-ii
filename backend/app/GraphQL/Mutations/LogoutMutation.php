<?php

namespace App\GraphQL\Mutations;

use App\GraphQL\Support\BaseMutation;
use App\GraphQL\Support\Context;
use App\Services\Auth\TokenService;
use GraphQL\Type\Definition\Type;

class LogoutMutation extends BaseMutation
{
    protected $attributes = ['name' => 'logout', 'description' => 'Выйти на этом устройстве'];

    public function type(): Type
    {
        return Type::nonNull(Type::boolean());
    }

    public function args(): array
    {
        return ['refreshToken' => ['type' => Type::string()]];
    }

    public function resolve($root, array $args, $ctx, TokenService $tokens): bool
    {
        $tokens->revokeRefresh($args['refreshToken'] ?? null);
        Context::user()?->currentAccessToken()?->delete();

        return true;
    }
}
