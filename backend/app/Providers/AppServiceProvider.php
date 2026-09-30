<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Общий предел для GraphQL: по пользователю (если токен есть) или по IP
        RateLimiter::for('graphql', function (Request $request) {
            $key = $request->bearerToken() ? 'token:'.sha1($request->bearerToken()) : 'ip:'.$request->ip();

            return Limit::perMinute(600)->by($key);
        });
        RateLimiter::for('uploads', fn (Request $request) => Limit::perMinute(120)->by($request->ip()));
        RateLimiter::for('telegram', fn (Request $request) => Limit::perMinute(600)->by($request->ip()));
    }
}
