<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $user_id
 * @property bool $enabled
 * @property ?string $telegram_chat_id
 * @property ?string $telegram_username
 * @property string $send_time
 * @property string $timezone
 * @property bool $birthdays
 * @property bool $anniversaries
 * @property bool $memorials
 * @property ?Carbon $last_sent_on
 */
#[Fillable(['user_id', 'enabled', 'telegram_chat_id', 'telegram_username', 'telegram_linked_at', 'send_time', 'timezone', 'birthdays', 'anniversaries', 'memorials', 'last_sent_on'])]
class NotificationSetting extends Model
{
    protected $primaryKey = 'user_id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $attributes = [
        'enabled' => true,
        'send_time' => '09:00',
        'timezone' => 'Europe/Moscow',
        'birthdays' => true,
        'anniversaries' => true,
        'memorials' => false,
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'birthdays' => 'boolean',
            'anniversaries' => 'boolean',
            'memorials' => 'boolean',
            'telegram_linked_at' => 'datetime',
            'last_sent_on' => 'date',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
