# Запуск в Docker

Проект запускается одной командой и в разработке, и в продакшне. Нужен только Docker (Docker Desktop на Windows и macOS,
Docker Engine с плагином Compose на Linux). Node.js, PHP и MySQL на компьютер ставить не нужно.

| Файл | Что это |
|---|---|
| `docker-compose.yml` (в корне) | Разработка. Подключает `docker/compose.dev.yml` |
| `docker-compose.prod.yml` (в корне) | Продакшн. Подключает `docker/compose.prod.yml` |
| `docker/compose.dev.yml` | Сервисы для разработки |
| `docker/compose.prod.yml` | Сервисы для сервера |
| `docker/caddy/Caddyfile` | Веб-сервер в продакшне: HTTPS, фронтенд, прокси API на бэкенд |
| `backend/Dockerfile` | Образ бэкенда (цели `dev` и `prod`) |
| `frontend/Dockerfile` | Сборка фронтенда и образ Caddy со статикой (цель `web`) |
| `.env.example` / `.env.prod.example` | Шаблоны настроек для разработки и для сервера |

Почему Docker Compose, а не Kubernetes: для стартапа с небольшим числом пользователей хватит одного сервера.
Compose проще в поддержке и дешевле, а данные хранятся в обычных папках на диске сервера, поэтому их просто
копировать в резервные копии. Когда понадобится несколько серверов, те же образы можно будет запускать и в Kubernetes.

## Разработка

```bash
git clone https://github.com/shevtsov-max/test-ii.git rodoslovnaya
cd rodoslovnaya
cp .env.example .env          # значения подходят как есть
docker compose up -d          # первый запуск — 3–10 минут: скачиваются образы и зависимости
```

| Адрес | Что там |
|---|---|
| http://localhost:5173 | Сайт (Vite, изменения во `frontend/` видны сразу) |
| http://localhost:8000/graphql | GraphQL API бэкенда (изменения в `backend/` применяются со следующего запроса) |
| http://localhost:8025 | Mailpit — все письма (подтверждение почты, приглашения) попадают сюда |
| localhost:3306 | MySQL (пользователь и пароль — из `.env`) |

Сервисы разработки:

| Сервис | Что делает |
|---|---|
| `mysql` | MySQL 8.4. Данные — в Docker-томе `rodoslovnaya-dev_mysql` |
| `backend` | Laravel Octane на FrankenPHP. При первом старте ставит зависимости (`composer install`) и применяет миграции |
| `worker` | Очередь: отправка писем |
| `scheduler` | Планировщик: напоминания в Telegram, очистка файлов и устаревших токенов |
| `bot` | Telegram-бот в режиме опроса (без публичного адреса). Без токена просто ждёт |
| `frontend` | Vite-сервер. Запросы `/graphql`, `/api`, `/files` проксирует в `backend` |
| `mailpit` | Почтовый ящик для разработки |

Частые команды:

```bash
docker compose ps                                   # состояние сервисов
docker compose logs -f backend                      # логи бэкенда
docker compose exec backend php artisan test        # тесты бэкенда
docker compose exec backend php artisan migrate:fresh   # пересоздать базу (все данные удалятся)
docker compose exec frontend npm test               # тесты фронтенда
docker compose restart worker scheduler bot         # перезапустить фоновые процессы после правок в коде
docker compose down                                 # остановить (данные сохранятся)
docker compose down -v                              # остановить и удалить базу и node_modules
```

Если порт занят (например, у вас уже запущен MySQL на 3306), поменяйте `DB_FORWARD_PORT`, `FRONTEND_PORT`,
`BACKEND_PORT` или `MAILPIT_PORT` в `.env` и выполните `docker compose up -d` ещё раз.

Уведомления в Telegram в разработке: создайте тестового бота у [@BotFather](https://t.me/BotFather), впишите
`TELEGRAM_BOT_TOKEN` и `TELEGRAM_BOT_USERNAME` в `.env` и выполните `docker compose up -d` — сервис `bot` начнёт
получать сообщения.

## Продакшн

Пошаговая инструкция для нового сервера — [`docs/deploy.md`](../docs/deploy.md). Коротко:

```bash
cp .env.prod.example .env      # заполните все значения <…>
docker compose -f docker-compose.prod.yml up -d --build
```

Сервисы продакшна:

| Сервис | Что делает |
|---|---|
| `init` | Один раз при запуске выставляет права на папку файлов и завершается |
| `mysql` | MySQL 8.4. Порт наружу не открыт |
| `backend` | Бэкенд (образ `prod`: код и зависимости внутри образа, кеши конфигурации). Применяет миграции при старте |
| `worker`, `scheduler` | Очередь и планировщик — тот же образ бэкенда |
| `web` | Caddy: получает и продлевает HTTPS-сертификат Let's Encrypt, раздаёт фронтенд, проксирует `/graphql`, `/api`, `/files`, `/telegram` в бэкенд |

### Где хранятся данные

Всё, что нельзя потерять, лежит в каталоге `DATA_DIR` на диске сервера (по умолчанию `/srv/rodoslovnaya`):

```
/srv/rodoslovnaya/
  mysql/      база данных
  storage/    фото и документы пользователей
  caddy/      HTTPS-сертификаты
```

Это обычные папки на хосте, а не тома Docker: они переживают перезапуск, пересоздание и обновление контейнеров,
перезагрузку сервера и случайную команду `docker compose down -v`. Все сервисы запущены с `restart: unless-stopped` —
после сбоя или перезагрузки сервера они поднимаются сами. MySQL настроен на надёжную запись на диск
(`db/mysql/conf.d/rodoslovnaya.cnf`), поэтому аварийное выключение не повреждает базу.

Защищает ли это от потери диска целиком? Нет — для этого нужны резервные копии в другом месте (их настроим отдельно,
см. раздел «Резервные копии» в `docs/deploy.md`).
