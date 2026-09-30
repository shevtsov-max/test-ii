<?php

namespace App\Services\Auth;

use App\Models\User;
use App\Models\UserToken;
use Illuminate\Support\Str;

/** Одноразовые токены для ссылок из писем и привязки Telegram. В базе хранится только хеш. */
final class OneTimeTokens
{
    public function create(User $user, string $type, int $ttlMinutes, array $payload = []): string
    {
        // Предыдущие неиспользованные токены того же типа больше не нужны
        UserToken::where('user_id', $user->id)->where('type', $type)->whereNull('used_at')->delete();
        $plain = Str::random(48);
        UserToken::create([
            'user_id' => $user->id,
            'type' => $type,
            'token_hash' => hash('sha256', $plain),
            'payload' => $payload ?: null,
            'expires_at' => now()->addMinutes($ttlMinutes),
        ]);

        return $plain;
    }

    /** Проверить и погасить токен. */
    public function consume(string $type, string $plain): ?UserToken
    {
        $token = UserToken::where('token_hash', hash('sha256', $plain))
            ->where('type', $type)
            ->whereNull('used_at')
            ->where('expires_at', '>', now())
            ->first();
        $token?->update(['used_at' => now()]);

        return $token;
    }
}
