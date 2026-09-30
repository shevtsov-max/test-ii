<?php

use App\Http\Controllers\FileController;
use App\Http\Controllers\TelegramWebhookController;
use App\Http\Controllers\UploadController;
use Illuminate\Support\Facades\Route;

/*
 * HTTP-маршруты вне GraphQL. Основной API — POST /graphql (config/graphql.php).
 * Здоровье сервиса — GET /up (bootstrap/app.php).
 */

Route::get('/', fn () => response()->json([
    'name' => config('app.name'),
    'api' => url('/graphql'),
    'schema' => 'docs/api/schema.graphql',
]));

// Загрузка файла по подписанной ссылке из мутации createUpload
Route::put('/api/uploads/{upload}', UploadController::class)
    ->name('uploads.store')
    ->middleware('throttle:uploads');

// Файлы древ
Route::get('/files/{tree}/{name}', FileController::class)
    ->where(['tree' => '[0-9a-z]{26}', 'name' => '[A-Za-z0-9]{40}\.[a-z0-9]{2,5}']);

// Telegram-бот (вебхук включается командой telegram:webhook)
Route::post('/telegram/webhook', TelegramWebhookController::class)->middleware('throttle:telegram');
