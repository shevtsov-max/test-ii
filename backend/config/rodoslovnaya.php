<?php

/*
 * Настройки приложения «Прапра». Значения — из переменных окружения (см. .env.example в корне проекта).
 */
return [

    // Адрес фронтенда: из него строятся ссылки в письмах (#/verify-email, #/reset-password, #/invite/…)
    'frontend_url' => rtrim(env('FRONTEND_URL', env('APP_URL', 'http://localhost')), '/'),

    'auth' => [
        // Токен доступа живёт недолго; клиент сам обновляет его токеном обновления
        'access_ttl_minutes' => (int) env('AUTH_ACCESS_TTL', 60),
        'refresh_ttl_days' => (int) env('AUTH_REFRESH_TTL_DAYS', 60),
        'password_reset_ttl_minutes' => 60,
        'email_verification_ttl_hours' => 72,
    ],

    /*
     * Юридические документы и их текущие редакции. Тексты — на фронтенде (frontend/src/app/legal.js);
     * при изменении текста повышайте версию в ОБОИХ местах: пользователи увидят просьбу принять новую редакцию.
     * required — без согласия с документом нельзя зарегистрироваться.
     */
    'legal' => [
        'terms' => ['version' => '2026-10-02', 'required' => true],
        'privacy' => ['version' => '2026-10-02', 'required' => true],
        'personal_data' => ['version' => '2026-10-02', 'required' => true],
        'marketing' => ['version' => '2026-10-02', 'required' => false],
    ],

    'trees' => [
        'max_per_user' => (int) env('TREES_MAX_PER_USER', 50),
        'max_entities' => (int) env('TREES_MAX_ENTITIES', 50000),
        // Максимальный размер одной сущности в JSON (персона с биографией, событиями и т. п.)
        'max_entity_bytes' => 256 * 1024,
    ],

    'media' => [
        // Диск Laravel для файлов (config/filesystems.php)
        'disk' => env('MEDIA_DISK', 'media'),
        'max_upload_mb' => (int) env('MEDIA_MAX_UPLOAD_MB', 20),
        'allowed_mimes' => [
            'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
            'application/pdf',
            'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav',
            'video/mp4', 'video/webm', 'video/quicktime',
            'text/plain',
        ],
    ],

    'invitations' => [
        'ttl_days' => 30,
    ],

    'telegram' => [
        'bot_token' => env('TELEGRAM_BOT_TOKEN'),
        // Имя бота без @ — для ссылки https://t.me/<bot>?start=<token>
        'bot_username' => env('TELEGRAM_BOT_USERNAME'),
        // Секрет вебхука: проверяется в заголовке X-Telegram-Bot-Api-Secret-Token
        'webhook_secret' => env('TELEGRAM_WEBHOOK_SECRET'),
        'api_url' => env('TELEGRAM_API_URL', 'https://api.telegram.org'),
    ],

    'support_email' => env('SUPPORT_EMAIL', 'support@example.com'),
];
