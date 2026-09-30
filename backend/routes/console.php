<?php

use Illuminate\Support\Facades\Schedule;

/*
 * Расписание (контейнер scheduler выполняет `php artisan schedule:work`).
 */

// Ежедневные сводки в Telegram: каждые 5 минут отправляем тем, у кого наступило выбранное время
Schedule::command('notifications:send')->everyFiveMinutes()->withoutOverlapping();

// Уборка: файлы без ссылок, просроченные токены
Schedule::command('media:cleanup')->dailyAt('03:30')->withoutOverlapping();
Schedule::command('sanctum:prune-expired --hours=24')->daily();
Schedule::command('auth:prune-tokens')->daily();
