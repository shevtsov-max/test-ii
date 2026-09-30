<?php

namespace App\GraphQL\Mutations;

use App\GraphQL\Support\ApiError;
use App\GraphQL\Support\BaseMutation;
use App\GraphQL\Support\Throttle;
use App\Services\Auth\EmailVerification;
use GraphQL\Type\Definition\Type;

class ResendVerificationEmailMutation extends BaseMutation
{
    protected $attributes = ['name' => 'resendVerificationEmail', 'description' => 'Отправить письмо подтверждения ещё раз'];

    public function type(): Type
    {
        return Type::nonNull(Type::boolean());
    }

    public function resolve($root, array $args, $ctx, EmailVerification $verification): bool
    {
        $user = $this->user();
        if ($user->email_verified_at) {
            throw ApiError::validation('Почта уже подтверждена');
        }
        Throttle::hit('verify-mail:'.$user->id, 3, 3600);
        $verification->send($user);

        return true;
    }
}
