<?php

namespace App\GraphQL\Mutations;

use App\GraphQL\Support\BaseMutation;
use App\GraphQL\Support\Throttle;
use App\Mail\ResetPasswordMail;
use App\Models\User;
use App\Models\UserToken;
use App\Services\Auth\OneTimeTokens;
use GraphQL\Type\Definition\Type;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

/** Письмо со ссылкой на новый пароль. Ответ всегда true — нельзя узнать, зарегистрирован ли адрес. */
class RequestPasswordResetMutation extends BaseMutation
{
    protected $attributes = ['name' => 'requestPasswordReset', 'description' => 'Отправить ссылку для нового пароля'];

    public function type(): Type
    {
        return Type::nonNull(Type::boolean());
    }

    public function args(): array
    {
        return ['email' => ['type' => Type::nonNull(Type::string())]];
    }

    public function resolve($root, array $args, $ctx, Request $request, OneTimeTokens $tokens): bool
    {
        $email = mb_strtolower(trim($args['email']));
        Throttle::hit('reset:'.$request->ip(), 10, 3600);
        Throttle::hit('reset-mail:'.$email, 3, 3600);

        if ($user = User::where('email', $email)->first()) {
            $token = $tokens->create($user, UserToken::PASSWORD_RESET, config('rodoslovnaya.auth.password_reset_ttl_minutes'));
            Mail::to($user->email)->queue(new ResetPasswordMail($user->name, config('rodoslovnaya.frontend_url').'/#/reset-password?token='.$token));
        }

        return true;
    }
}
