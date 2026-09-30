<?php

namespace App\GraphQL\Support;

use App\Models\User;
use Illuminate\Support\Facades\Auth;

/** Текущий пользователь запроса (по токену Bearer). */
final class Context
{
    public static function user(): ?User
    {
        /** @var ?User */
        return Auth::guard('sanctum')->user();
    }

    public static function requireUser(): User
    {
        return self::user() ?? throw ApiError::unauthenticated();
    }
}
