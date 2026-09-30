<?php

namespace App\Services\Notifications;

use App\Domain\Anniversaries;
use App\Models\NotificationSetting;
use Carbon\CarbonImmutable;

/**
 * Ежедневная сводка памятных дат в Telegram.
 * Команда notifications:send (каждые 5 минут) отправляет сводку тем, у кого наступило выбранное время.
 */
final class DailyDigest
{
    private const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

    public function __construct(
        private readonly UpcomingEvents $events,
        private readonly TelegramClient $telegram,
    ) {}

    /** Отправить всем, кому пора. @return int сколько отправлено */
    public function sendDue(?CarbonImmutable $now = null): int
    {
        $now ??= CarbonImmutable::now();
        $sent = 0;
        NotificationSetting::query()
            ->where('enabled', true)
            ->whereNotNull('telegram_chat_id')
            ->with('user')
            ->chunkById(200, function ($chunk) use ($now, &$sent) {
                foreach ($chunk as $s) {
                    $local = $now->setTimezone($this->timezone($s->timezone));
                    if ($local->format('H:i') < $s->send_time || $s->last_sent_on?->toDateString() === $local->toDateString()) {
                        continue;
                    }
                    // Отмечаем заранее: при сбое сети сообщение не уйдёт дважды
                    $s->update(['last_sent_on' => $local->toDateString()]);
                    $text = $this->compose($s, $local->startOfDay(), false);
                    if ($text !== null && $this->telegram->send($s->telegram_chat_id, $text)) {
                        $sent++;
                    }
                }
            }, 'user_id');

        return $sent;
    }

    /**
     * Текст сводки или null, если сегодня нет дат (и $always = false).
     */
    public function compose(NotificationSetting $s, CarbonImmutable $today, bool $always): ?string
    {
        $kinds = [
            Anniversaries::BIRTHDAY => $s->birthdays,
            Anniversaries::WEDDING => $s->anniversaries,
            'memorials' => $s->memorials,
        ];
        $all = $this->events->forUser($s->user, $today, 7, $kinds);
        $todayEvents = array_filter($all, fn ($e) => $e['inDays'] === 0);
        $soon = array_filter($all, fn ($e) => $e['inDays'] > 0 && $e['inDays'] <= 3);
        if (! $todayEvents && ! $always) {
            return null;
        }

        $lines = ['<b>Сегодня, '.$today->day.' '.self::MONTHS[$today->month - 1].'</b>', ''];
        if ($todayEvents) {
            foreach ($todayEvents as $e) {
                $lines[] = e(Anniversaries::describe($e)).' <i>('.e($e['treeName']).')</i>';
            }
        } else {
            $lines[] = 'Сегодня памятных дат нет.';
        }
        if ($soon) {
            $lines[] = '';
            $lines[] = '<b>Скоро</b>';
            foreach (array_slice($soon, 0, 8) as $e) {
                $date = CarbonImmutable::parse($e['date']);
                $lines[] = $date->day.' '.self::MONTHS[$date->month - 1].': '.e(Anniversaries::describe($e));
            }
        }
        $lines[] = '';
        $lines[] = '<a href="'.e(config('rodoslovnaya.frontend_url')).'/#/app">Открыть «Родословную»</a>';

        return implode("\n", $lines);
    }

    private function timezone(string $tz): string
    {
        return in_array($tz, timezone_identifiers_list(), true) ? $tz : 'Europe/Moscow';
    }
}
