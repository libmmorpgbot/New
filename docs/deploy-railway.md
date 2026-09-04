# Деплой на Railway

Игра — **один сервис**. Процесс из `apps/server` держит на одном порту всё:
статику клиента, API, игровой WebSocket и бота (long polling).

Так проще и дешевле, но главное — исчезает целый класс ошибок: клиент и API на
одном домене, поэтому нет ни CORS, ни адресов, которые надо прописывать, ни
второго `JWT_SECRET`, который может разойтись с первым.

Нужно ровно две вещи:

- сервис из этого репозитория;
- плагин **PostgreSQL** (`+ New` → `Database` → `PostgreSQL`).

Redis из `docker-compose.yml` пока не нужен — в коде он не используется
(понадобится, когда игровых нод станет несколько).

## 1. Создать сервис

`New Project` → `Deploy from GitHub repo` → этот репозиторий, ветка `main`.

**Railway почти наверняка создаст два сервиса** — `@tg-mmo/client` и
`@tg-mmo/server`. Он видит pnpm-воркспейс и заводит сервис на каждый пакет.
Для этого проекта так не надо: клиент — это статика, которую раздаёт сервер.

- удали сервис `@tg-mmo/client` (`Settings` → внизу `Delete Service`);
- оставь `@tg-mmo/server`.

Дальше в **Settings** оставшегося сервиса проверь одно поле:

| Поле | Значение |
| --- | --- |
| Root Directory | **пусто** (корень репозитория) |

Если Railway проставил туда `apps/server` — сотри. Это pnpm-воркспейс,
установка из подпапки не соберётся, и клиент собран не будет.

Команды подставятся сами из `railway.json` в корне репозитория:

```
Build     pnpm install --frozen-lockfile && pnpm build
Start     pnpm start
Health    /api/health
```

Если хочется задать их руками — они же в `Settings`, поля
`Build Command`, `Start Command` и `Healthcheck Path`.

## 2. Переменные окружения

| Переменная | Значение |
| --- | --- |
| `JWT_SECRET` | длинная случайная строка |
| `BOT_TOKEN` | токен от [@BotFather](https://t.me/botfather) |
| `DEV_LOGIN` | `0` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `WEBAPP_URL` | адрес самого сервиса, см. шаг 3 |

`PORT` Railway подставляет сам. Адреса API и сокета клиенту задавать не нужно —
он на том же домене и находит их сам.

## 3. Домен и бот

`Settings` → `Networking` → `Generate Domain`. Получишь адрес вида
`ashen-production-xxxx.up.railway.app`.

Впиши его в `WEBAPP_URL` **со схемой и слешем**:

```
WEBAPP_URL=https://ashen-production-xxxx.up.railway.app/
```

После рестарта в логах появится `[bot] polling started`. Если вместо этого
`бот выключен: нужны BOT_TOKEN и WEBAPP_URL` — одна из двух переменных пустая.

## 4. Миграции

Один раз, локально, против публичного адреса базы (Railway показывает его в
плагине Postgres как `DATABASE_PUBLIC_URL`):

```bash
DATABASE_URL="postgres://...@...proxy.rlwy.net:PORT/railway" pnpm db:push
```

Без этого игра запустится, но прогресс сохраняться не будет — сервер напишет
ошибку в лог и продолжит работать в памяти.

## 5. Подключить к Telegram

В @BotFather: `/mybots` → бот → `Bot Settings` → `Menu Button` → адрес сервиса.
Затем `/start` в боте — кнопка «Играть» откроет Mini App.

## Что сервер пишет при старте

```
[server] listening on :8080
[server] client=on telegram-auth=on dev-login=off db=on
[bot] polling started
```

Эта строка — быстрая диагностика: `client=off` значит клиент не собран,
`telegram-auth=off` — нет `BOT_TOKEN`, `db=off` — нет `DATABASE_URL`.
`dev-login=ON` в продакшене означает, что в игру пускают без Telegram — так быть не должно.

## Если что-то не работает

| Симптом | Причина |
| --- | --- |
| Сборка падает на `pnpm install` | задан Root Directory — убери, нужен корень репозитория |
| Сервисов больше одного | Railway завёл по сервису на пакет — удали все, кроме `@tg-mmo/server` |
| `client=off` в логе | не выполнен `pnpm build` в Build Command |
| «Не удалось авторизоваться (401)» | неверный `BOT_TOKEN` |
| «Открой игру через Telegram» | так и задумано при `DEV_LOGIN=0` |
| Бот молчит, в логе «бот выключен» | пустой `BOT_TOKEN` или `WEBAPP_URL` |
| Прогресс не сохраняется | не выполнен `pnpm db:push`, либо не проставлен `DATABASE_URL` |
| Healthcheck не проходит | путь должен быть `/api/health`, не `/health` |

## Когда сервис придётся разделить

Один процесс держит порядка сотни игроков в одной комнате. Дальше узкое место —
игровой тик, а не HTTP, и разделять надо так:

1. Вынести раздачу статики на CDN — при сборке проставить клиенту
   `VITE_SERVER_URL=https://<адрес игрового сервиса>`, и он будет ходить туда.
2. Поднять несколько экземпляров игрового процесса с `SERVE_CLIENT=0` и
   `RUN_BOT=0`, добавить Redis-presence Colyseus и раскидать зоны по нодам.
3. Бота оставить в одном экземпляре — Telegram не любит несколько
   параллельных long polling на один токен.

Переменные `SERVE_CLIENT` и `RUN_BOT` для этого уже есть.
