<?php

namespace App\Console\Commands;

use App\Services\Notifications\TelegramClient;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('telegram:webhook {--delete : Отключить вебхук}')]
#[Description('Подключить вебхук Telegram-бота к https://<домен>/telegram/webhook')]
class TelegramWebhook extends Command
{
    public function handle(TelegramClient $telegram): int
    {
        if (! $telegram->configured()) {
            $this->error('Задайте TELEGRAM_BOT_TOKEN и TELEGRAM_BOT_USERNAME');

            return self::FAILURE;
        }
        if ($this->option('delete')) {
            $res = $telegram->call('deleteWebhook');
        } else {
            $secret = config('rodoslovnaya.telegram.webhook_secret');
            if (! $secret) {
                $this->error('Задайте TELEGRAM_WEBHOOK_SECRET (случайная строка из латиницы и цифр)');

                return self::FAILURE;
            }
            $url = rtrim(config('app.url'), '/').'/telegram/webhook';
            $res = $telegram->call('setWebhook', ['url' => $url, 'secret_token' => $secret, 'allowed_updates' => ['message']]);
            $this->line('Вебхук: '.$url);
        }
        $this->line(json_encode($res, JSON_UNESCAPED_UNICODE));

        return ($res['ok'] ?? false) ? self::SUCCESS : self::FAILURE;
    }
}
