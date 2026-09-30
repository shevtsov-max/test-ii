<?php

namespace App\GraphQL\Mutations;

use App\GraphQL\Support\ApiError;
use App\GraphQL\Support\BaseMutation;
use App\GraphQL\Support\Throttle;
use App\Models\User;
use App\Services\Auth\TokenService;
use GraphQL\Type\Definition\Type;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Rebing\GraphQL\Support\Facades\GraphQL;

class LoginMutation extends BaseMutation
{
    protected $attributes = ['name' => 'login', 'description' => 'Вход по почте и паролю'];

    public function type(): Type
    {
        return Type::nonNull(GraphQL::type('AuthPayload'));
    }

    public function args(): array
    {
        return [
            'email' => ['type' => Type::nonNull(Type::string())],
            'password' => ['type' => Type::nonNull(Type::string())],
        ];
    }

    public function resolve($root, array $args, $ctx, Request $request, TokenService $tokens): array
    {
        $email = mb_strtolower(trim($args['email']));
        $key = 'login:'.$request->ip().'|'.$email;
        Throttle::hit($key, 10, 900);

        $user = User::where('email', $email)->first();
        if (! $user || ! Hash::check($args['password'], $user->password)) {
            throw ApiError::validation('Неверная почта или пароль');
        }
        Throttle::clear($key);

        return $tokens->issue($user, $request);
    }
}
