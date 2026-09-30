# Развёртывание на сервере

Инструкция для нового сервера с Ubuntu 24.04. Всё запускается в Docker: Caddy (HTTPS и фронтенд), бэкенд на
Laravel Octane + FrankenPHP, очередь, планировщик и MySQL. Устройство сервисов — [`docker/README.md`](../docker/README.md).

## 1. Где разместить

Данные пользователей — персональные данные граждан РФ, поэтому **база должна находиться на серверах в России**
(ч. 5 ст. 18 152-ФЗ). Зарубежные VPS (Hetzner, DigitalOcean и т. п.) не подходят.

На старте хватит одного виртуального сервера **2 vCPU / 2–4 ГБ RAM / 40–60 ГБ NVMe** с Ubuntu 24.04:

| Провайдер | Что взять | Ориентир по цене | Плюсы |
|---|---|---|---|
| **Timeweb Cloud** (рекомендую для старта) | «Cloud 40»: 2 vCPU, 2 ГБ, 40 NVMe (или 4 ГБ RAM, если бюджет позволяет) | от ~555 ₽/мес | Дёшево, почасовая оплата, снимки дисков и S3 для бэкапов, ЦОД в Москве и Санкт-Петербурге, простая панель |
| Selectel | Облачный сервер 2 vCPU / 4 ГБ | ~1 000–1 500 ₽/мес | Аттестованные по 152-ФЗ сегменты, если понадобится, сильная поддержка |
| Yandex Cloud | Compute Cloud, прерываемые ВМ не брать | ~1 500–2 500 ₽/мес | Managed MySQL и Object Storage, когда проект вырастет |

Цены меняются — сверяйтесь с сайтом провайдера. Дополнительно:
- **Домен** — у регистратора в зоне .ru/.рф (REG.RU, RU-CENTER, Timeweb) — 200–900 ₽/год.
- **Почта для писем** (подтверждение, приглашения): Unisender Go, Yandex Postbox или SMTP почты для домена — на старте бесплатно
  или несколько сотен рублей в месяц.
- **Резервные копии**: S3-хранилище того же провайдера — копейки за гигабайт.

Итого на старте: **≈ 600–1 000 ₽ в месяц**.

## 2. Подготовка сервера

Подключитесь по SSH под root (данные доступа придут от провайдера) и выполните по порядку.

```bash
# Обновления и базовые пакеты
apt update && apt upgrade -y
apt install -y ca-certificates curl git ufw unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades        # автоматические обновления безопасности

# Часовой пояс сервера (приложение работает в UTC, это только для удобства логов)
timedatectl set-timezone Europe/Moscow

# Swap 2 ГБ — страховка на сервере с 2 ГБ памяти
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Docker (официальный скрипт ставит Docker Engine и плагин Compose)
curl -fsSL https://get.docker.com | sh
docker compose version

# Брандмауэр: только SSH и веб
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
```

Рекомендуется войти по SSH-ключу и запретить вход по паролю (`PasswordAuthentication no` в `/etc/ssh/sshd_config`,
затем `systemctl restart ssh`) — только убедитесь, что вход по ключу уже работает.

> Docker публикует порты в обход ufw. В проекте наружу открыты только 80 и 443 (Caddy); MySQL и бэкенд доступны
> лишь внутри сети Docker.

## 3. Домен

У регистратора домена создайте A-запись: `ваш-домен.ru → IP сервера` (и `www`, если нужен). Проверка:

```bash
dig +short ваш-домен.ru      # должен вернуть IP сервера
```

HTTPS-сертификат Caddy получит сам при первом запуске, когда домен начнёт указывать на сервер.

## 4. Установка проекта

```bash
mkdir -p /opt && cd /opt
git clone https://github.com/shevtsov-max/test-ii.git rodoslovnaya
cd rodoslovnaya
cp .env.prod.example .env
```

Сгенерируйте секреты:

```bash
echo "APP_KEY=base64:$(openssl rand -base64 32)"
echo "DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')"
echo "DB_ROOT_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')"
echo "TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)"
```

Откройте `.env` (`nano .env`) и замените все `<…>`:

| Переменная | Что указать |
|---|---|
| `APP_KEY`, `DB_PASSWORD`, `DB_ROOT_PASSWORD` | Сгенерированные выше значения |
| `APP_URL`, `FRONTEND_URL` | `https://ваш-домен.ru` |
| `SITE_ADDRESS` | `ваш-домен.ru` (без https://). Для проверки без домена — `http://IP-сервера` |
| `ACME_EMAIL` | Ваша почта — Let's Encrypt пришлёт сюда предупреждения о сертификате |
| `MAIL_*` | Данные SMTP почтового сервиса |
| `OPERATOR_*`, `SUPPORT_EMAIL` | Реквизиты оператора персональных данных — попадут в юридические документы сайта (см. [`docs/legal.md`](legal.md)) |
| `TELEGRAM_*` | Необязательно: токен и имя бота от @BotFather |

Сохраните резервную копию `.env` в менеджере паролей: без `APP_KEY` не расшифровать ссылки-приглашения.

```bash
chmod 600 .env
mkdir -p /srv/rodoslovnaya          # сюда лягут база, файлы и сертификаты (DATA_DIR)
```

## 5. Запуск

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Первая сборка занимает 5–10 минут. Затем проверьте:

```bash
docker compose -f docker-compose.prod.yml ps          # все сервисы Up, backend — healthy
docker compose -f docker-compose.prod.yml logs -f web # Caddy: сообщение о полученном сертификате
curl -I https://ваш-домен.ru                          # HTTP/2 200
```

Откройте сайт, зарегистрируйтесь и проверьте, что пришло письмо с подтверждением почты.

Если настроен Telegram-бот, зарегистрируйте вебхук (бот начнёт получать сообщения):

```bash
docker compose -f docker-compose.prod.yml exec backend php artisan telegram:webhook
```

Для удобства можно завести короткую команду:

```bash
echo "alias dc='docker compose -f /opt/rodoslovnaya/docker-compose.prod.yml --project-directory /opt/rodoslovnaya'" >> ~/.bashrc
source ~/.bashrc      # дальше: dc ps, dc logs -f backend …
```

## 6. Обновление

```bash
cd /opt/rodoslovnaya
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f           # удалить старые образы
```

Миграции базы применяются автоматически при старте бэкенда. Перед обновлениями с изменениями базы сделайте снимок
базы (см. ниже). Если после обновления что-то сломалось — `git checkout <предыдущий коммит>` и та же команда `up -d --build`.

## 7. Надёжность данных

- База, файлы и сертификаты хранятся в `/srv/rodoslovnaya` — обычной папке на диске сервера. Перезапуск и
  пересоздание контейнеров, обновление проекта и перезагрузка сервера их не затрагивают.
- Все сервисы перезапускаются сами после сбоя или перезагрузки (`restart: unless-stopped`); бэкенд стартует только
  после того, как MySQL готов, а очередь и планировщик — после бэкенда.
- MySQL записывает каждую транзакцию на диск сразу (`innodb_flush_log_at_trx_commit=1`, `sync_binlog=1`) и ведёт
  бинарный журнал 7 дней — после аварийного выключения база восстанавливается сама.

### Резервные копии

Полноценную схему (автоматические ежедневные копии в S3 другого провайдера или региона, проверка восстановления)
обсудим и настроим отдельно. До этого делайте хотя бы ручной снимок и включите снимки диска в панели провайдера
(Timeweb: «Бэкапы» у сервера, ~несколько рублей за ГБ в месяц):

```bash
cd /opt/rodoslovnaya
docker compose -f docker-compose.prod.yml exec -T mysql sh -c \
  'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines rodoslovnaya' | gzip > /root/db-$(date +%F).sql.gz
tar -czf /root/files-$(date +%F).tar.gz -C /srv/rodoslovnaya storage
```

Скопируйте эти файлы к себе (`scp root@сервер:/root/db-*.sql.gz .`).

## 8. Наблюдение

```bash
dc ps                              # состояние
dc logs --tail=200 backend         # ошибки приложения
dc logs --tail=200 worker          # отправка писем
docker stats --no-stream           # память и процессор
df -h /srv                         # место на диске
```

Бесплатно следить за доступностью можно через UptimeRobot или аналог: проверка `https://ваш-домен.ru/up` раз в 5 минут
с оповещением в Telegram.

## 9. Частые проблемы

| Симптом | Что сделать |
|---|---|
| Caddy не получает сертификат | Проверьте A-запись домена (`dig +short`), открыты ли порты 80 и 443, указан ли `ACME_EMAIL`. Логи: `dc logs web` |
| `backend` не становится healthy | `dc logs backend`: чаще всего неверный `APP_KEY` или пароль БД. После смены `DB_*` в `.env` на уже созданной базе пароль нужно менять и в MySQL |
| Не приходят письма | `dc logs worker`; проверьте `MAIL_*` и SPF/DKIM домена у почтового сервиса |
| Закончилась память при сборке | Добавьте swap (шаг 2) или соберите образы на другом компьютере |
