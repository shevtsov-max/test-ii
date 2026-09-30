<?php

namespace App\GraphQL\Mutations;

use App\GraphQL\Support\BaseMutation;
use App\GraphQL\Support\Throttle;
use App\Services\Auth\TokenService;
use GraphQL\Type\Definition\Type;
use Illuminate\Http\Request;
use Rebing\GraphQL\Support\Facades\GraphQL;

/** Новая пара токенов по токену обновления (старый при этом гасится). */
class RefreshTokenMutation extends BaseMutation
{
    protected $attributes = ['name' => 'refreshToken', 'description' => 'Обновить токены'];

    public function type(): Type
    {
        return Type::nonNull(GraphQL::type('AuthPayload'));
    }

    public function args(): array
    {
        return ['refreshToken' => ['type' => Type::nonNull(Type::string())]];
    }

    public function resolve($root, array $args, $ctx, Request $request, TokenService $tokens): array
    {
        Throttle::hit('refresh:'.$request->ip(), 120, 60);

        return $tokens->refresh($args['refreshToken'], $request);
    }
}
