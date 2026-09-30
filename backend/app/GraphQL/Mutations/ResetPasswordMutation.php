<?php

namespace App\GraphQL\Mutations;

use App\GraphQL\Support\ApiError;
use App\GraphQL\Support\BaseMutation;
use App\GraphQL\Support\Throttle;
use App\Models\UserToken;
use App\Services\Auth\OneTimeTokens;
use App\Services\Auth\TokenService;
use GraphQL\Type\Definition\Type;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;
use Rebing\GraphQL\Support\Facades\GraphQL;

/** Новый пароль по ссылке из письма; все прежние сеансы завершаются. */
class ResetPasswordMutation extends BaseMutation
{
    protected $attributes = ['name' => 'resetPassword', 'description' => 'Задать новый пароль по ссылке из письма'];

    public function type(): Type
    {
        return Type::nonNull(GraphQL::type('AuthPayload'));
    }

    public function args(): array
    {
        return [
            'token' => ['type' => Type::nonNull(Type::string())],
            'password' => ['type' => Type::nonNull(Type::string())],
        ];
    }

    protected function rules(array $args = []): array
    {
        return ['password' => ['required', 'string', Password::min(8)->letters()->numbers()]];
    }

    public function resolve($root, array $args, $ctx, Request $request, OneTimeTokens $oneTime, TokenService $tokens): array
    {
        Throttle::hit('reset-password:'.$request->ip(), 20, 3600);
        $token = $oneTime->consume(UserToken::PASSWORD_RESET, $args['token']);
        if (! $token) {
            throw ApiError::validation('Ссылка недействительна или устарела — запросите новую');
        }
        $user = $token->user;
        $user->update(['password' => $args['password']]);
        // Письмо пришло на почту — значит, адрес подтверждён
        if (! $user->email_verified_at) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }
        $tokens->revokeAll($user);

        return $tokens->issue($user, $request);
    }
}
