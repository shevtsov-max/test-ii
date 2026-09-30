<?php

namespace App\Console\Commands;

use App\Services\Notifications\DailyDigest;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('notifications:send')]
#[Description('Отправить ежедневные сводки памятных дат в Telegram тем, у кого наступило время')]
class SendNotifications extends Command
{
    public function handle(DailyDigest $digest): int
    {
        $n = $digest->sendDue();
        $this->info("Отправлено сводок: {$n}");

        return self::SUCCESS;
    }
}
