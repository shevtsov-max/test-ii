# API «Прапра»

Один эндпоинт GraphQL: `POST /graphql` (JSON `{ query, variables }`). Полная схема — [`schema.graphql`](schema.graphql);
она **генерируется** из кода бэкенда: после изменения типов выполните

```bash
docker compose exec backend php artisan graphql:print-schema --output=../docs/api/schema.graphql
```

Кроме GraphQL есть несколько обычных HTTP-адресов:

| Адрес | Зачем |
|---|---|
| `PUT /api/uploads/{id}?signature=…` | Загрузка файла по подписанной ссылке из `createUpload` (тело запроса — сам файл) |
| `GET /files/{treeId}/{name}` | Файл древа (фото, документ). Имя из 40 случайных символов — ссылку знают только те, кому доступно древо |
| `POST /telegram/webhook` | Вебхук Telegram-бота (проверяется заголовок `X-Telegram-Bot-Api-Secret-Token`) |
| `GET /up` | Проверка здоровья для Docker и мониторинга |

## Авторизация

- `register` / `login` / `resetPassword` возвращают `{ accessToken, refreshToken, user }`.
- Запросы — с заголовком `Authorization: Bearer <accessToken>`. Токен доступа живёт 60 минут (`AUTH_ACCESS_TTL`).
- Когда сервер ответил `UNAUTHENTICATED`, клиент вызывает `refreshToken(refreshToken)` и повторяет запрос.
  Refresh-токен одноразовый (ротация); повторное использование старого токена отзывает всю цепочку — так
  обнаруживается кража. Реализация клиента — `frontend/src/api/graphql/client.js`.
- `register` требует согласий `consents: [{ document, version }]` на текущие редакции `terms`, `privacy`,
  `personal_data`. Если редакция обновилась, `me.pendingConsents` содержит документы, которые нужно принять
  (`acceptDocuments`).

## Ошибки

Все ошибки — в стандартном поле `errors` с кодом:

```json
{ "message": "Этот адрес уже зарегистрирован", "extensions": { "code": "CONFLICT", "fields": { "email": "Адрес уже используется" } } }
```

| Код | Когда |
|---|---|
| `UNAUTHENTICATED` | Нет токена или он истёк |
| `FORBIDDEN` | Нет прав (читатель пытается править, ветка передана родственнику) |
| `NOT_FOUND` | Нет такого объекта или нет доступа к нему (чужое древо выглядит как несуществующее) |
| `VALIDATION` | Неверные данные; `fields` — сообщения для полей формы |
| `CONFLICT` | Данные изменил кто-то другой, приглашение уже использовано и т. п. |
| `RATE_LIMITED` | Слишком много попыток |
| `INTERNAL` | Ошибка сервера (подробности только в логах) |

## Древо: данные и сохранение

- Древо (`TreeData`) — словари сущностей по id: `persons`, `families`, `places`, `media`, `sources`, `clans`.
  **Идентификаторы создаёт клиент** (буквы, цифры, `_-.:@`, до 64 символов) — поэтому клиент работает без ожидания
  сервера и может хранить изменения в очереди.
- Сохранение — `applyTreeChanges(treeId, changes)`: только изменённые сущности (`upsertPersons`, `deleteFamilies`, …)
  и поля древа (`tree`). `baseVersion` — версия, от которой отталкивался клиент: если **эту же сущность** после неё
  изменил другой участник, сервер вернёт `CONFLICT`, и клиент перечитает древо. Правки разных людей не конфликтуют.
- `replace` заменяет содержимое древа целиком (импорт). Невозможен, пока ветки древа переданы родственникам.
- Сервер нормализует каждую сущность (`backend/app/Domain/TreeSchema.php`): неизвестные поля отбрасываются,
  длины обрезаются. `data:`-адреса в медиа (импорт резервной копии с фото) превращаются в файлы.

## Совместная работа

- `inviteMember` — пригласить в древо с ролью `editor` или `viewer` (письмо со ссылкой `/#/invite/m…`).
- `createDelegation` — передать ветку родственнику (письмо и/или ссылка `/#/invite/d…`); `delegations`,
  `delegatedBranches` — список передач и живые данные веток; `cloneDelegation` — скопировать ветку себе;
  `revokeDelegation` — отозвать непринятое приглашение.
- `invitation(token)` — что за приглашение (без входа), `acceptInvitation` / `declineInvitation`.

## Уведомления

`notificationSettings`, `updateNotificationSettings`, `createTelegramLink` (ссылка на бота с одноразовым кодом),
`disconnectTelegram`, `sendTestNotification`, `upcomingEvents(days, timezone)` — ближайшие памятные даты по всем
древам пользователя.
