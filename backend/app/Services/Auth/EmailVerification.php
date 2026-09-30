<?php

namespace App\Services\Auth;

use App\Mail\VerifyEmailMail;
use App\Models\User;
use App\Models\UserToken;
use Illuminate\Support\Facades\Mail;

/** Письмо со ссылкой подтверждения почты (#/verify-email?token=…). */
final class EmailVerification
{
    public function __construct(private readonly OneTimeTokens $tokens) {}

    public function send(User $user): void
    {
        $ttl = config('rodoslovnaya.auth.email_verification_ttl_hours') * 60;
        $token = $this->tokens->create($user, UserToken::EMAIL_VERIFICATION, $ttl, ['email' => $user->email]);
        Mail::to($user->email)->queue(new VerifyEmailMail($user->name, config('rodoslovnaya.frontend_url').'/#/verify-email?token='.$token));
    }
}
