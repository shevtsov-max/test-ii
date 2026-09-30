<?php

namespace App\Services\Notifications;

use App\Models\NotificationSetting;
use App\Models\UserToken;
use App\Services\Auth\OneTimeTokens;
use Carbon\CarbonImmutable;

/**
 * Обработка сообщений боту: привязка учётной записи (/start <токен>), /today, /stop, /help.
 * Обновления приходят вебхуком (прод) или командой telegram:poll (разработка).
 */
final class TelegramBot
{
    public function __construct(
        private readonly TelegramClient $telegram,
        private readonly OneTimeTokens $tokens,
        private readonly DailyDigest $digest,
    ) {}

    public function handle(array $update): void
    {
        $message = $update['message'] ?? null;
        $chatId = (string) ($message['chat']['id'] ?? '');
        $text = trim((string) ($message['text'] ?? ''));
        if ($chatId === '' || $text === '' || ($message['chat']['type'] ?? '') !== 'private') {
            return;
        }
        [$command, $arg] = array_pad(explode(' ', $text, 2), 2, '');
        $command = strtolower(explode('@', $command)[0]);

        match ($command) {
            '/start' => $arg !== '' ? $this->link($chatId, trim($arg), $message['from']['username'] ?? null) : $this->help($chatId),
            '/today' => $this->today($chatId),
            '/stop' => $this->stop($chatId),
            default => $this->help($chatId),
        };
    }

    private function link(string $chatId, string $token, ?string $username): void
    {
        $t = $this->tokens->consume(UserToken::TELEGRAM_LINK, $token);
        if (! $t) {
            $this->telegram->send($chatId, 'Ссылка устарела. Откройте «Учётная запись → Уведомления» и нажмите «Подключить Telegram» ещё раз.');

            return;
        }
        // Чат может быть привязан только к одной учётной записи
        NotificationSetting::where('telegram_chat_id', $chatId)->where('user_id', '!=', $t->user_id)->update(['telegram_chat_id' => null]);
        $s = NotificationSetting::firstOrNew(['user_id' => $t->user_id]);
        $s->fill([
            'telegram_chat_id' => $chatId,
            'telegram_username' => $username,
            'telegram_linked_at' => now(),
            'enabled' => true,
        ])->save();
        $this->telegram->send($chatId, "Готово! Каждый день в {$s->send_time} я буду присылать дни рождения и другие памятные даты ваших родственников.\n\n/today — даты на сегодня\n/stop — отключить уведомления");
    }

    private function today(string $chatId): void
    {
        $s = NotificationSetting::where('telegram_chat_id', $chatId)->with('user')->first();
        if (! $s) {
            $this->help($chatId);

            return;
        }
        $today = CarbonImmutable::now($s->timezone)->startOfDay();
        $this->telegram->send($chatId, $this->digest->compose($s, $today, true));
    }

    private function stop(string $chatId): void
    {
        $n = NotificationSetting::where('telegram_chat_id', $chatId)->update(['enabled' => false]);
        $this->telegram->send($chatId, $n ? 'Уведомления отключены. Включить их снова можно в настройках «Родословной».' : 'Этот чат не привязан к учётной записи.');
    }

    private function help(string $chatId): void
    {
        $this->telegram->send($chatId, "Я бот «Родословной»: напоминаю о днях рождения и памятных датах родственников.\n\nЧтобы подключиться, откройте на сайте «Учётная запись → Уведомления» и нажмите «Подключить Telegram».\n\n/today — даты на сегодня\n/stop — отключить уведомления");
    }
}
