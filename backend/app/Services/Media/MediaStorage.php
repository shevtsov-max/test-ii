<?php

namespace App\Services\Media;

use App\GraphQL\Support\ApiError;
use App\Models\Tree;
use App\Models\Upload;
use App\Models\User;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

/**
 * Файлы древ (фото, сканы документов).
 *
 * Файл лежит на диске media по пути «<treeId>/<случайное имя>.<расширение>» и отдаётся по адресу /files/<путь>.
 * Имя из 40 случайных символов нельзя подобрать: ссылку видят только те, кому доступно древо.
 * Загрузка — в два шага: createUpload выдаёт подписанную ссылку, клиент отправляет файл PUT-запросом.
 */
final class MediaStorage
{
    private const EXT = [
        'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif',
        'image/heic' => 'heic', 'image/heif' => 'heif', 'application/pdf' => 'pdf',
        'audio/mpeg' => 'mp3', 'audio/mp4' => 'm4a', 'audio/ogg' => 'ogg', 'audio/wav' => 'wav',
        'video/mp4' => 'mp4', 'video/webm' => 'webm', 'video/quicktime' => 'mov', 'text/plain' => 'txt',
    ];

    public function disk(): Filesystem
    {
        return Storage::disk(config('rodoslovnaya.media.disk'));
    }

    public function maxBytes(): int
    {
        return config('rodoslovnaya.media.max_upload_mb') * 1024 * 1024;
    }

    /** @return array{uploadUrl: string, fileUrl: string, thumbUrl: null, headers: array} */
    public function createUpload(Tree $tree, User $user, string $filename, string $mime, int $size): array
    {
        $mime = strtolower(trim($mime));
        if (! in_array($mime, config('rodoslovnaya.media.allowed_mimes'), true)) {
            throw ApiError::validation('Такой тип файла не поддерживается. Загрузите фото, PDF, аудио или видео.', ['file' => 'Неподдерживаемый тип файла']);
        }
        if ($size <= 0 || $size > $this->maxBytes()) {
            throw ApiError::validation('Файл больше '.config('rodoslovnaya.media.max_upload_mb').' МБ', ['file' => 'Слишком большой файл']);
        }
        $upload = Upload::create([
            'tree_id' => $tree->id,
            'user_id' => $user->id,
            'path' => $this->newPath($tree->id, $mime),
            'mime' => $mime,
            'size' => $size,
            'expires_at' => now()->addMinutes(30),
        ]);
        // Относительная подписанная ссылка: работает за любым прокси на том же домене
        $url = URL::temporarySignedRoute('uploads.store', $upload->expires_at, ['upload' => $upload->id], absolute: false);

        return ['uploadUrl' => $url, 'fileUrl' => $this->url($upload->path), 'thumbUrl' => null, 'headers' => []];
    }

    /** Принять тело PUT-запроса. */
    public function store(Upload $upload, $stream, ?int $length): void
    {
        if ($upload->completed_at) {
            throw ApiError::conflict('Файл уже загружен');
        }
        if ($upload->expires_at->isPast()) {
            throw ApiError::forbidden('Ссылка для загрузки устарела');
        }
        if ($length !== null && $length > min($this->maxBytes(), (int) ($upload->size * 1.05) + 1024)) {
            throw ApiError::validation('Размер файла не совпадает с заявленным');
        }
        $this->disk()->writeStream($upload->path, $stream);
        if ($this->disk()->size($upload->path) > $this->maxBytes()) {
            $this->disk()->delete($upload->path);
            throw ApiError::validation('Файл слишком большой');
        }
        $upload->update(['completed_at' => now()]);
    }

    public function url(string $path): string
    {
        return '/files/'.$path;
    }

    /** Путь на диске по адресу /files/… или null для внешних ссылок. */
    public function pathFromUrl(?string $url): ?string
    {
        if (! $url || ! str_starts_with($url, '/files/')) {
            return null;
        }
        $path = substr($url, 7);

        return preg_match('~^[0-9a-z]{26}/[A-Za-z0-9]{40}\.[a-z0-9]{2,5}$~', $path) ? $path : null;
    }

    /**
     * data:-адреса в src/thumb (импорт резервной копии со встроенными фото) → файлы на диске.
     */
    public function externalize(Tree $tree, array $media): array
    {
        foreach (['src', 'thumb'] as $key) {
            $v = $media[$key] ?? null;
            if (! is_string($v) || ! str_starts_with($v, 'data:')) {
                continue;
            }
            if (! preg_match('~^data:([a-z0-9.+/-]+);base64,(.+)$~is', $v, $m)) {
                $media[$key] = null;

                continue;
            }
            $mime = strtolower($m[1]);
            $bytes = base64_decode($m[2], true);
            if ($bytes === false || strlen($bytes) > $this->maxBytes() || ! isset(self::EXT[$mime])) {
                $media[$key] = null;

                continue;
            }
            $path = $this->newPath($tree->id, $mime);
            $this->disk()->put($path, $bytes);
            $media[$key] = $this->url($path);
            if ($key === 'src') {
                $media['mime'] = $media['mime'] ?: $mime;
                $media['size'] = strlen($bytes);
            }
        }

        return $media;
    }

    /** Копия файла в другое древо (клонирование ветки): у копии свой жизненный цикл. */
    public function copyTo(?string $url, Tree $target): ?string
    {
        $path = $this->pathFromUrl($url);
        if (! $path || str_starts_with($path, $target->id.'/') || ! $this->disk()->exists($path)) {
            return $url;
        }
        $new = $target->id.'/'.Str::random(40).'.'.pathinfo($path, PATHINFO_EXTENSION);
        $this->disk()->copy($path, $new);

        return $this->url($new);
    }

    public function deleteTreeFiles(string $treeId): void
    {
        $this->disk()->deleteDirectory($treeId);
    }

    /**
     * Удалить файлы, на которые больше не ссылается ни одна запись древа, и незавершённые загрузки.
     * Свежие файлы (моложе суток) не трогаем — их может ещё сохранять клиент.
     */
    public function cleanup(): int
    {
        $removed = 0;
        Upload::whereNull('completed_at')->where('expires_at', '<', now()->subDay())->delete();
        foreach ($this->disk()->directories() as $treeId) {
            if (! DB::table('trees')->where('id', $treeId)->exists()) {
                $this->disk()->deleteDirectory($treeId);

                continue;
            }
            $used = [];
            foreach (DB::table('tree_media')->where('tree_id', $treeId)->pluck('data') as $json) {
                $m = json_decode($json, true);
                foreach (['src', 'thumb'] as $k) {
                    if ($p = $this->pathFromUrl($m[$k] ?? null)) {
                        $used[$p] = true;
                    }
                }
            }
            foreach ($this->disk()->files($treeId) as $file) {
                if (! isset($used[$file]) && $this->disk()->lastModified($file) < now()->subDay()->getTimestamp()) {
                    $this->disk()->delete($file);
                    $removed++;
                }
            }
        }

        return $removed;
    }

    private function newPath(string $treeId, string $mime): string
    {
        return strtolower($treeId).'/'.Str::random(40).'.'.(self::EXT[$mime] ?? 'bin');
    }
}
