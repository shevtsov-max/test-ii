# Бэкенд «Родословной» — правила для разработки

Laravel 13 + Octane (FrankenPHP) + rebing/graphql-laravel + Sanctum, PHP 8.4, MySQL 8.4. Устройство — `README.md`,
контракт API — `../docs/api/`.

## Команды

- `php artisan test` — тесты (SQLite в памяти; в Docker: `docker compose exec backend php artisan test`)
- `vendor/bin/pint` — форматирование (запускать перед коммитом)
- `php artisan graphql:print-schema --output=../docs/api/schema.graphql` — после любого изменения типов/операций

Перед коммитом: `php artisan test`, `vendor/bin/pint --test`, обновлённая схема в `docs/api/schema.graphql`.

## Соглашения

- Операции GraphQL — тонкие: права (`TreeAccess::require`) + вызов сервиса. Логика — в `app/Services`, чистые
  функции без БД — в `app/Domain`.
- Ошибки для пользователя — только `ApiError` (коды `VALIDATION`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`,
  `RATE_LIMITED`), сообщения — по-русски, понятные человеку. `fields` — ключи полей формы.
- Код работает под Octane: никакого состояния в статических свойствах и синглтонах между запросами; текущий
  пользователь — `Context::user()` / `$this->user()`.
- Сущности древа хранятся как JSON в `tree_*`; формат — как у фронтенда (`frontend/src/domain/types.js`),
  нормализация — `App\Domain\TreeSchema`. Новое поле модели — добавить и там, и на фронтенде.
- Ветки, переданные родственникам, закрыты для правки в `TreeRepository::assertNotLocked` — новые способы изменить
  древо должны проходить через `TreeRepository::apply`.
- Версии юридических документов — `config/rodoslovnaya.php` → `legal`; должны совпадать с
  `frontend/src/app/legal.js`.
- Каждая новая операция — тест в `tests/Feature` через `$this->graphql()` (как настоящий клиент).
- Комментарии и описания полей схемы — по-русски.
