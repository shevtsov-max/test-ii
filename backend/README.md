# Бэкенд «Прапра»

GraphQL API для фронтенда: учётные записи, древа, файлы, совместный доступ, передача веток родственникам,
напоминания в Telegram, юридические согласия.

**Стек:** PHP 8.4, Laravel 13, [Octane](https://laravel.com/docs/octane) на FrankenPHP,
[rebing/graphql-laravel](https://github.com/rebing/graphql-laravel) (webonyx/graphql-php), Sanctum (токены), MySQL 8.4.

## Запуск

Всё запускается из корня репозитория через Docker — см. [`docker/README.md`](../docker/README.md):

```bash
cp .env.example .env && docker compose up -d
docker compose exec backend php artisan test         # тесты (SQLite в памяти, база не нужна)
docker compose exec backend vendor/bin/pint           # форматирование кода
docker compose exec backend php artisan tinker        # консоль
```

Без Docker (нужны PHP 8.4 с pdo_mysql/pdo_sqlite и Composer): `composer install`, `cp .env.example .env`,
`php artisan key:generate`, `php artisan test`.

## Устройство

```
app/
  GraphQL/
    Queries/, Mutations/   по классу на операцию: args() → rules() → resolve(); только проверка прав и вызов сервиса
    Types/, Inputs/, Enums/, Scalars/   типы схемы (регистрируются в config/graphql.php)
    Support/               BaseQuery/BaseMutation, ApiError (коды ошибок), ErrorFormatter, Throttle, Context
  Services/                бизнес-логика — сюда смотреть в первую очередь
    Auth/                  токены (доступ + одноразовый refresh с ротацией), подтверждение почты, одноразовые коды
    Trees/                 TreeRepository (чтение, сохранение изменений, версии), TreeAccess (роли), MembershipService (участники)
    Delegations/           передача ветки родственнику
    Media/                 загрузка и хранение файлов
    Notifications/         памятные даты, ежедневная сводка, Telegram-бот
    Legal/                 журнал согласий с документами
  Domain/                  чистая логика без БД: TreeSchema (нормализация сущностей), Branch (ветка), Anniversaries, Dates, Names
  Models/, Enums/, Mail/, Http/Controllers/ (загрузка файлов, выдача файлов, вебхук Telegram), Console/Commands/
config/rodoslovnaya.php    настройки проекта: версии документов, лимиты, Telegram, приглашения
database/migrations/       схема БД
routes/web.php             HTTP-адреса кроме GraphQL; routes/console.php — расписание
tests/                     Feature (через GraphQL, как настоящий клиент) и Unit (Domain)
```

### Хранение древа

Древо — строка в `trees` (название, версия, сводка для списка) и сущности в таблицах `tree_persons`,
`tree_families`, `tree_places`, `tree_media`, `tree_sources`, `tree_clans`: `(tree_id, id)` → JSON `data` + `version`.
Формат JSON совпадает с моделью фронтенда (`frontend/src/domain/types.js`), сервер его нормализует (`TreeSchema`).
Так сохранение отправляет только изменённые записи, а конфликт возникает, лишь если одну и ту же запись изменили двое.

### Как добавить операцию

1. Логика — метод сервиса в `app/Services/...` (+ тест).
2. Класс в `app/GraphQL/Queries` или `Mutations` (наследник `BaseQuery`/`BaseMutation`): `type()`, `args()`,
   `rules()`, `resolve()`. Права — через `TreeAccess::require($user, $treeId, TreeRole::Editor)`.
   Ошибки для пользователя — `throw ApiError::validation('…', ['field' => '…'])` и т. п.
3. Зарегистрировать класс в `config/graphql.php`.
4. Обновить схему: `php artisan graphql:print-schema --output=../docs/api/schema.graphql`.
5. Добавить операцию во фронтенд: `frontend/src/api/graphql/operations.js` и адаптер `index.js`
   (и заглушку в `frontend/src/api/local`, если в локальном режиме функции нет).

## Фоновые процессы и команды

| Команда | Где запускается |
|---|---|
| `queue:work` | контейнер `worker` — письма |
| `schedule:work` | контейнер `scheduler` — `notifications:send` каждые 5 минут, `media:cleanup`, очистка токенов |
| `telegram:poll` | контейнер `bot` в разработке (опрос вместо вебхука) |
| `telegram:webhook [--delete]` | один раз на сервере — зарегистрировать вебхук бота |
| `graphql:print-schema --output=…` | выгрузить схему в SDL |

## Безопасность

- Пароли — bcrypt; токен доступа живёт 60 минут, refresh-токен — одноразовый, повторное использование отзывает все.
- Лимиты запросов: GraphQL 600/мин, попытки входа и восстановления пароля — отдельные лимиты (`Throttle`).
- Чужое древо неотличимо от несуществующего (`NOT_FOUND`).
- Файлы — по неугадываемым ссылкам; загрузка — по подписанной ссылке с проверкой типа и размера.
- Ошибки сервера не раскрывают подробностей клиенту (`INTERNAL`), подробности — в логе.
