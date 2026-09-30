#!/bin/sh
# Запуск контейнера бэкенда (app, worker, scheduler, bot — один образ, разные команды).
set -e
cd /app

# Разработка: зависимости ставит только основной контейнер, остальные ждут
if [ ! -f vendor/autoload.php ]; then
  if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    echo "Устанавливаю зависимости PHP (composer install)…"
    composer install --no-interaction --prefer-dist
  else
    echo "Жду установки зависимостей…"
    while [ ! -f vendor/autoload.php ]; do sleep 2; done
    sleep 3
  fi
fi

if [ -z "$APP_KEY" ]; then
  echo "ОШИБКА: не задан APP_KEY. Сгенерируйте: openssl rand -base64 32 и впишите APP_KEY=base64:<значение> в .env" >&2
  exit 1
fi

# Ждём базу данных
i=0
until php -r 'try { new PDO("mysql:host=".getenv("DB_HOST").";port=".(getenv("DB_PORT") ?: 3306), getenv("DB_USERNAME"), getenv("DB_PASSWORD")); } catch (Throwable $e) { exit(1); }' 2>/dev/null; do
  i=$((i + 1))
  [ "$i" -gt 60 ] && { echo "База данных недоступна" >&2; exit 1; }
  echo "Жду базу данных…"; sleep 2
done

if [ "$APP_ENV" = "production" ]; then
  php artisan optimize --quiet
fi

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  php artisan migrate --force --no-interaction
fi

exec "$@"
