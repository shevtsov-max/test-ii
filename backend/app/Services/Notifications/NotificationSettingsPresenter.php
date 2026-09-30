<?php

namespace App\Services\Notifications;

use App\Models\NotificationSetting;
use App\Models\User;

/** Настройки уведомлений в форме GraphQL-типа NotificationSettings. */
final class NotificationSettingsPresenter
{
    public function __construct(private readonly TelegramClient $telegram) {}

    public function present(User $user): array
    {
        $s = NotificationSetting::firstOrNew(['user_id' => $user->id]);

        return [
            'available' => $this->telegram->configured(),
            'botUsername' => $this->telegram->username(),
            'telegramLinked' => (bool) $s->telegram_chat_id,
            'telegramUsername' => $s->telegram_username,
            'enabled' => (bool) $s->enabled,
            'sendTime' => $s->send_time,
            'timezone' => $s->timezone,
            'birthdays' => (bool) $s->birthdays,
            'anniversaries' => (bool) $s->anniversaries,
            'memorials' => (bool) $s->memorials,
        ];
    }
}
