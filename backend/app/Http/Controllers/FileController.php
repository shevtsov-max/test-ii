<?php

namespace App\Http\Controllers;

use App\Services\Media\MediaStorage;
use Symfony\Component\HttpFoundation\Response;

/**
 * Отдача файлов древ (GET /files/{tree}/{name}). Имя файла — 40 случайных символов, поэтому адрес
 * работает как ключ доступа; файл не меняется, отсюда долгий кеш.
 */
class FileController
{
    public function __invoke(string $tree, string $name, MediaStorage $media): Response
    {
        $path = $media->pathFromUrl("/files/{$tree}/{$name}");
        if (! $path || ! $media->disk()->exists($path)) {
            abort(404);
        }

        return $media->disk()->response($path, null, [
            'Cache-Control' => 'private, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
            // Документы открываются в браузере, но не выполняются как страница нашего сайта
            'Content-Security-Policy' => "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
        ]);
    }
}
