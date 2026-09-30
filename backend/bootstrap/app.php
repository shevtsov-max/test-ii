<?php

use App\GraphQL\Support\ApiError;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Http\Request;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Приложение работает за обратным прокси (Caddy / Vite): доверяем его заголовкам X-Forwarded-*
        $middleware->trustProxies(at: '*');
        // API без cookie-сессий (токен в заголовке Authorization): сессии и CSRF не нужны
        $middleware->web(remove: [
            PreventRequestForgery::class,
            StartSession::class,
            ShareErrorsFromSession::class,
            EncryptCookies::class,
            AddQueuedCookiesToResponse::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Ошибки, предназначенные пользователю (неверный пароль, нет прав…), — не сбой: в журнал не пишем
        $exceptions->dontReport([ApiError::class]);
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => true);
    })->create();
