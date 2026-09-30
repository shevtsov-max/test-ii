# База данных (MySQL 8.4)

| Файл | Зачем |
|---|---|
| `mysql/conf.d/rodoslovnaya.cnf` | Кодировка utf8mb4, UTC, размер кеша InnoDB под небольшой сервер, надёжная запись на диск, журнал для восстановления на момент времени. Подключается и в разработке, и в продакшне. |
| `init/01-test-database.sh` | Только для разработки: при первом запуске создаёт базу `<имя>_test` для тестов бэкенда на MySQL. |

Схему базы создают миграции Laravel (`backend/database/migrations`) — они выполняются автоматически при старте
контейнера `backend`. Описание таблиц — в самих миграциях.

## Где лежат данные

- **Разработка** — Docker-том `rodoslovnaya-dev_mysql` (удаляется только командой `docker compose down -v`).
- **Продакшн** — каталог на диске сервера `${DATA_DIR}/mysql` (по умолчанию `/srv/rodoslovnaya/mysql`).
  Это обычная папка на хосте: она переживает перезапуск, пересоздание и обновление контейнеров, а случайное
  `docker compose down -v` её не удалит. См. `docs/deploy.md`.

## Полезные команды

```bash
# Консоль MySQL (разработка)
docker compose exec mysql mysql -urodoslovnaya -p rodoslovnaya

# Снимок базы в файл
docker compose exec mysql sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines rodoslovnaya' > dump.sql
```
