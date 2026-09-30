<?php

namespace App\Services\Notifications;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/** Минимальный клиент Telegram Bot API. */
final class TelegramClient
{
    public function configured(): bool
    {
        return (bool) config('rodoslovnaya.telegram.bot_token') && (bool) config('rodoslovnaya.telegram.bot_username');
    }

    public function username(): ?string
    {
        return config('rodoslovnaya.telegram.bot_username');
    }

    /** Отправить сообщение (HTML-разметка Telegram). */
    public function send(string $chatId, string $html): bool
    {
        $res = $this->call('sendMessage', [
            'chat_id' => $chatId,
            'text' => $html,
            'parse_mode' => 'HTML',
            'link_preview_options' => ['is_disabled' => true],
        ]);

        return (bool) ($res['ok'] ?? false);
    }

    public function call(string $method, array $params = [], int $timeout = 15): array
    {
        if (! $this->configured()) {
            return ['ok' => false, 'description' => 'Бот не настроен'];
        }
        $url = rtrim(config('rodoslovnaya.telegram.api_url'), '/').'/bot'.config('rodoslovnaya.telegram.bot_token').'/'.$method;
        try {
            return Http::timeout($timeout)->acceptJson()->post($url, $params)->json() ?? ['ok' => false];
        } catch (\Throwable $e) {
            Log::warning('Telegram API: '.$method.' — '.$e->getMessage());

            return ['ok' => false, 'description' => $e->getMessage()];
        }
    }
}
