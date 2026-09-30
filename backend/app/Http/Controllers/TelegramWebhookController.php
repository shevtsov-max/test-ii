<?php

namespace App\Http\Controllers;

use App\Services\Notifications\TelegramBot;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** Вебхук Telegram-бота (POST /telegram/webhook). Проверяется секрет из заголовка. */
class TelegramWebhookController
{
    public function __invoke(Request $request, TelegramBot $bot): Response
    {
        $secret = (string) config('rodoslovnaya.telegram.webhook_secret');
        if ($secret === '' || ! hash_equals($secret, (string) $request->header('X-Telegram-Bot-Api-Secret-Token'))) {
            abort(403);
        }
        $bot->handle($request->json()->all());

        return response()->noContent();
    }
}
