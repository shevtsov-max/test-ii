<?php

namespace App\Services\Auth;

use App\GraphQL\Support\ApiError;
use App\Models\RefreshToken;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Выдача и обновление токенов.
 *
 * accessToken — токен Sanctum на AUTH_ACCESS_TTL минут (заголовок Authorization: Bearer).
 * refreshToken — случайная строка на AUTH_REFRESH_TTL_DAYS дней; в базе только её SHA-256.
 * При каждом обновлении выдаётся новая пара, старый refresh-токен отзывается. Если отозванный токен
 * приходит снова (его украли и уже использовали), отзывается вся цепочка — владельцу придётся войти заново.
 */
final class TokenService
{
    /** @return array{accessToken: string, refreshToken: string, user: User} */
    public function issue(User $user, Request $request, ?string $family = null): array
    {
        $ttl = config('rodoslovnaya.auth.access_ttl_minutes');
        $access = $user->createToken('web', ['*'], now()->addMinutes($ttl))->plainTextToken;

        $plain = Str::random(64);
        RefreshToken::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $plain),
            'family' => $family ?? (string) Str::ulid(),
            'expires_at' => now()->addDays(config('rodoslovnaya.auth.refresh_ttl_days')),
            'ip' => $request->ip(),
            'user_agent' => Str::limit((string) $request->userAgent(), 250, ''),
        ]);

        return ['accessToken' => $access, 'refreshToken' => $plain, 'user' => $user];
    }

    /** @return array{accessToken: string, refreshToken: string, user: User} */
    public function refresh(string $plain, Request $request): array
    {
        $token = RefreshToken::where('token_hash', hash('sha256', $plain))->first();
        if (! $token || $token->expires_at->isPast()) {
            throw ApiError::unauthenticated('Сеанс истёк — войдите снова');
        }
        if ($token->revoked_at) {
            // Повторное использование: отзываем всю цепочку
            RefreshToken::where('family', $token->family)->whereNull('revoked_at')->update(['revoked_at' => now()]);
            throw ApiError::unauthenticated('Сеанс завершён — войдите снова');
        }
        $token->update(['revoked_at' => now(), 'last_used_at' => now()]);

        return $this->issue($token->user, $request, $token->family);
    }

    public function revokeRefresh(?string $plain): void
    {
        if ($plain) {
            RefreshToken::where('token_hash', hash('sha256', $plain))->update(['revoked_at' => now()]);
        }
    }

    /** Выход на всех устройствах (смена пароля, удаление учётной записи). */
    public function revokeAll(User $user): void
    {
        $user->tokens()->delete();
        RefreshToken::where('user_id', $user->id)->whereNull('revoked_at')->update(['revoked_at' => now()]);
    }
}
