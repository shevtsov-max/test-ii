# Родословная (family-tree)

Сервисы: `frontend/` (Vue 3 + JavaScript без TypeScript + Quasar + Pinia + vue-router + Vite, PWA, immer, IndexedDB),
`backend/` (Laravel 13 + Octane/FrankenPHP + rebing/graphql-laravel + Sanctum, PHP 8.4 — правила в `backend/CLAUDE.md`),
`db/` (MySQL 8.4), `docker/` (Compose dev/prod, Caddy).
Возможности и структура — в `README.md`, устройство — в `docs/architecture.md`, контракт API — `docs/api/` (схема генерируется
из бэкенда), сервер — `docs/deploy.md`, законы о ПДн — `docs/legal.md`.

## Команды

Фронтенд (из `frontend/`):
- `npm ci`, `npm run dev` (http://localhost:5173, режим `local` без сервера), `npm test` (vitest), `npm run build`

Бэкенд (из `backend/`): `php artisan test`, `vendor/bin/pint`,
`php artisan graphql:print-schema --output=../docs/api/schema.graphql` (после изменения схемы).

Всё вместе: `cp .env.example .env && docker compose up -d` из корня (см. `docker/README.md`).

Перед коммитом всегда запускать `npm test` и `npm run build` во `frontend/`, а при изменениях бэкенда — `php artisan test`
и `vendor/bin/pint --test` в `backend/`.

## Процесс работы

Проект в разработке, прод-среды нет, поэтому изменения коммитятся и пушатся
**сразу в ветку `main`** (без PR и отдельных веток), если пользователь не попросил иначе.

После пуша в `main` GitHub Actions (`.github/workflows/deploy.yml`) прогоняет тесты фронтенда, собирает демо-версию (режим `local`)
и публикует его на GitHub Pages: https://shevtsov-max.github.io/test-ii/
Пользователь открывает этот адрес в браузере и присылает правки.

## Соглашения

- Пути ниже — внутри `frontend/`.
- Слои: `domain` (чистая логика, без Vue) → `api` (local | graphql) → `stores` → `pages/components`. Страницы и компоненты
  не обращаются к IndexedDB или fetch напрямую — только через `api` из `src/api/index.js`. Новая серверная функция —
  операция в `src/api/graphql/operations.js` + метод адаптера + заглушка в `src/api/local` + флаг в `api.capabilities`.
- Все изменения древа идут через действия стора `src/stores/tree.js` (они вызывают рецепты `src/domain/actions.js` внутри immer).
  Ветки, переданные родственникам, закрыты для правки: проверяйте `tree.canEdit(personId)` вместо `tree.readonly` в местах,
  где правится конкретная персона.
  Так работают отмена/повтор и отправка на сервер только изменённых сущностей. Новое действие — рецепт в `actions.js` +
  обёртка в сторе.
- Данные хранятся в IndexedDB (режим `local`); настройки интерфейса — в localStorage (`rd:prefs`, `rd:view:<id>`).
  Данные прежней версии (`ft:tree:v1`) переносятся автоматически при первом запуске (`src/app/legacy.js`).
- Иконки — только через `src/icons.generated.js` (генерируется `scripts/gen-icons.mjs` при `dev`/`build`), не подключать
  целиком библиотеку иконок. Скрипт предупреждает об отсутствующих в наборе именах — подберите другое.
- `vite.config.js` использует `base: './'` — не менять, иначе сломается деплой на Pages. Адреса — hash (`/#/app`).
- Цвета — только токены `--ft-*` из `src/styles/tokens.scss` (светлая и тёмная темы). Для тёмной темы в scoped-стилях
  писать `.класс:is(.body--dark *)`, а не `:global(.body--dark) .класс` (Vue превращает его в правило для всего `body`).
- При выпуске новой версии: повысить `version` в `frontend/package.json` и добавить запись в `src/app/changelog.js`
  (её покажет окно «Что нового» после обновления PWA).
- Юридические тексты — `src/app/legal.js`. Изменили текст — повысьте версию документа в `LEGAL_VERSIONS` **и** в
  `backend/config/rodoslovnaya.php` (`legal`): пользователи примут новую редакцию при входе.

## Тестовые данные

- Пути — внутри `frontend/`. `src/data/romanovs.js` — пример «Романовы» (Николай II и европейские династии, 72 человека): несколько браков,
  сводные братья/сёстры, помолвка, «схлопывание» предков.
- `src/data/seed.js` — пример «Семья Орловых» (`demoTree`), древо «Шевцовы», заготовка нового древа (`starterTree`).
- Портреты — собственные SVG-иллюстрации в `public/photos/`, генерируются `node scripts/gen-portraits.mjs`
  (не реальные фотографии). Подключаются через поле `ph` в данных.
- Примеры создаются кнопками на странице «Мои древа» и в мастере «Новое древо».

## Язык

Проект на чистом JavaScript (без TypeScript). Модель данных описана JSDoc-typedef'ами в `src/domain/types.js`.
Props/emits компонентов объявляются в рантайм-форме (`defineProps({...})`, `defineEmits([...])`); у булевых пропсов
обязательно `type: Boolean` (иначе `<Comp flag />` не превратится в `true`).

## Подписи родства на карточках

Над именем на каждой карточке написано, кем человек приходится персоне «Это Вы» (`homePersonId`): «Брат», «Двоюродный брат»,
«Прадедушка», «Муж свояченицы»… Считает `relationship()` в `src/domain/kinship.js`; включается настройкой древа
«Подписи родства» (`prefs.chart.relation`, по умолчанию включено). Размеры карточек — `src/domain/layout/metrics.js`.

## Отвергнутый эксперимент: ветки на месте

Проверяли режим, где «Показать предков/потомков» не перестраивает дерево, а добавляет строку рядом с карточкой (кнопка
становится «×» и скрывает ветку). Решено вернуться к прежнему поведению — «Показать предков» перестраивает дерево вокруг
этой персоны. Код эксперимента: ветка `experiment/inline-branches`, PR #2 (не сливать).
Механизм предпросмотра экспериментов оставлен: переменная `EXPERIMENTS` в `.github/workflows/deploy.yml`
(формат `путь=ветка`, сейчас пусто) публикует ветку рядом с основным сайтом в `/путь/`; пуш в `experiment/**` запускает пересборку.
