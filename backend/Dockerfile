# syntax=docker/dockerfile:1
#
# Бэкенд «Родословной»: Laravel Octane на FrankenPHP.
#   target dev  — код монтируется с хоста, зависимости ставятся при старте (docker/compose.dev.yml)
#   target prod — код и зависимости внутри образа, кеши конфигурации собираются при старте
#
# Базовый образ можно заменить (другая версия PHP или зеркало реестра): --build-arg PHP_IMAGE=…
ARG PHP_IMAGE=dunglas/frankenphp:1-php8.4
FROM ${PHP_IMAGE} AS base
USER root
# Уже установленные расширения установщик пропускает; unzip нужен Composer для архивов пакетов
RUN install-php-extensions pdo_mysql pcntl zip \
    && (command -v unzip >/dev/null || (apt-get update && apt-get install -y --no-install-recommends unzip && rm -rf /var/lib/apt/lists/*))
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
ENV COMPOSER_ALLOW_SUPERUSER=1 \
    OCTANE_SERVER=frankenphp \
    LOG_CHANNEL=stderr \
    OPCACHE_VALIDATE_TIMESTAMPS=1
WORKDIR /app
COPY docker/entrypoint.sh /usr/local/bin/entrypoint
COPY docker/php.ini $PHP_INI_DIR/conf.d/zz-rodoslovnaya.ini
ENTRYPOINT ["entrypoint"]
EXPOSE 8000

# ---------------------------------------------------------------- разработка
FROM base AS dev
ENV APP_ENV=local
# --max-requests=1: воркер перезапускается после каждого запроса — правки кода видны сразу
CMD ["php", "artisan", "octane:frankenphp", "--host=0.0.0.0", "--port=8000", "--workers=2", "--max-requests=1"]

# ---------------------------------------------------------------- зависимости
FROM base AS vendor
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --no-interaction --prefer-dist
COPY . .
RUN composer dump-autoload --no-dev --optimize --classmap-authoritative \
    && php artisan package:discover --ansi

# ---------------------------------------------------------------- продакшн
FROM base AS prod
ENV APP_ENV=production APP_DEBUG=false OPCACHE_VALIDATE_TIMESTAMPS=0
RUN if [ -f "$PHP_INI_DIR/php.ini-production" ]; then cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"; fi
COPY --from=vendor /app /app
# Octane запускает встроенный Caddy: ему нужны записываемые каталоги данных и настроек
ENV XDG_CONFIG_HOME=/app/storage/caddy/config XDG_DATA_HOME=/app/storage/caddy/data
RUN mkdir -p storage/app/media storage/framework/cache storage/framework/views storage/logs storage/caddy bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache
USER www-data
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD curl -fsS http://127.0.0.1:8000/up || exit 1
CMD ["php", "artisan", "octane:frankenphp", "--host=0.0.0.0", "--port=8000", "--workers=auto", "--max-requests=1000"]
