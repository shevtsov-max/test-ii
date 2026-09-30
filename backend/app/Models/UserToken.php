<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Одноразовый токен (сброс пароля, подтверждение почты, привязка Telegram).
 *
 * @property string $user_id
 * @property string $type
 * @property ?array $payload
 * @property Carbon $expires_at
 * @property ?Carbon $used_at
 */
#[Fillable(['user_id', 'type', 'token_hash', 'payload', 'expires_at', 'used_at'])]
class UserToken extends Model
{
    public const PASSWORD_RESET = 'password_reset';

    public const EMAIL_VERIFICATION = 'email_verification';

    public const TELEGRAM_LINK = 'telegram_link';

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'expires_at' => 'datetime',
            'used_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
