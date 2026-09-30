<?php

namespace App\GraphQL\Mutations;

use App\GraphQL\Support\ApiError;
use App\GraphQL\Support\BaseMutation;
use App\Models\UserToken;
use App\Services\Auth\OneTimeTokens;
use GraphQL\Type\Definition\Type;

class VerifyEmailMutation extends BaseMutation
{
    protected $attributes = ['name' => 'verifyEmail', 'description' => 'Подтвердить почту по ссылке из письма'];

    public function type(): Type
    {
        return Type::nonNull(Type::boolean());
    }

    public function args(): array
    {
        return ['token' => ['type' => Type::nonNull(Type::string())]];
    }

    public function resolve($root, array $args, $ctx, OneTimeTokens $oneTime): bool
    {
        $token = $oneTime->consume(UserToken::EMAIL_VERIFICATION, $args['token']);
        $user = $token?->user;
        // Ссылка относится к адресу, на который её отправили: после смены почты старая не подходит
        if (! $user || ($token->payload['email'] ?? null) !== $user->email) {
            throw ApiError::validation('Ссылка недействительна или устарела.');
        }
        $user->forceFill(['email_verified_at' => now()])->save();

        return true;
    }
}
