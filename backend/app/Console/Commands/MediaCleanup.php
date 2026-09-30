<?php

namespace App\Console\Commands;

use App\Services\Media\MediaStorage;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('media:cleanup')]
#[Description('Удалить файлы, на которые не ссылается ни одна запись древа')]
class MediaCleanup extends Command
{
    public function handle(MediaStorage $media): int
    {
        $this->info('Удалено файлов: '.$media->cleanup());

        return self::SUCCESS;
    }
}
