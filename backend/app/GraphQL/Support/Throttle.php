<?php

namespace App\GraphQL\Support;

use Illuminate\Support\Facades\RateLimiter;

/** Ограничение числа попыток (вход, регистрация, письма) — защита от перебора и спама. */
final class Throttle
{
    public static function hit(string $key, int $maxAttempts, int $decaySeconds): void
    {
        if (RateLimiter::tooManyAttempts($key, $maxAttempts)) {
            throw ApiError::tooManyAttempts(RateLimiter::availableIn($key));
        }
        RateLimiter::hit($key, $decaySeconds);
    }

    public static function clear(string $key): void
    {
        RateLimiter::clear($key);
    }
}
