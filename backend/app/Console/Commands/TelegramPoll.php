<?php

namespace App\Console\Commands;

use App\Services\Notifications\TelegramBot;
use App\Services\Notifications\TelegramClient;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/** Для разработки: получать сообщения боту без публичного адреса (long polling вместо вебхука). */
#[Signature('telegram:poll')]
#[Description('Получать сообщения Telegram-боту опросом (разработка, без вебхука)')]
class TelegramPoll extends Command
{
    public function handle(TelegramClient $telegram, TelegramBot $bot): int
    {
        if (! $telegram->configured()) {
            $this->warn('TELEGRAM_BOT_TOKEN и TELEGRAM_BOT_USERNAME не заданы — бот выключен.');
            // Не падаем: контейнер разработки просто ждёт, пока бот настроят
            while (true) {
                sleep(3600);
            }
        }
        $telegram->call('deleteWebhook');
        $offset = 0;
        $this->info('Жду сообщения боту @'.$telegram->username().'…');
        while (true) {
            $res = $telegram->call('getUpdates', ['offset' => $offset, 'timeout' => 50], timeout: 60);
            foreach ($res['result'] ?? [] as $update) {
                $offset = $update['update_id'] + 1;
                try {
                    $bot->handle($update);
                } catch (\Throwable $e) {
                    report($e);
                }
            }
            if (! ($res['ok'] ?? false)) {
                sleep(5);
            }
        }
    }
}
