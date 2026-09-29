# Родословная (family-tree)

Vue 3 + TypeScript + Quasar + Pinia + Vite. Подробности и структура — в `README.md`.

## Команды

- `npm ci` — установка зависимостей
- `npm run dev` — dev-сервер (http://localhost:5173)
- `npm run build` — иконки + `vue-tsc` + сборка в `dist/`
- `npm run typecheck` — только проверка типов

Перед коммитом всегда запускать `npm run build` (он же проверяет типы).

## Процесс работы

Проект в разработке, прод-среды нет, поэтому изменения коммитятся и пушатся
**сразу в ветку `main`** (без PR и отдельных веток), если пользователь не попросил иначе.

После пуша в `main` GitHub Actions (`.github/workflows/deploy.yml`) собирает сайт
и публикует его на GitHub Pages: https://shevtsov-max.github.io/test-ii/
Пользователь открывает этот адрес в браузере и присылает правки.

## Соглашения

- Данные хранятся в localStorage; все изменения дерева идут через действия стора `src/stores/tree.ts`.
- Иконки — только через `src/icons.generated.ts` (генерируется `scripts/gen-icons.mjs`), не подключать целиком библиотеку иконок.
- `vite.config.ts` использует `base: './'` — не менять, иначе сломается деплой на Pages.
