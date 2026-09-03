# Деплой на Railway

Четыре сервиса в проекте — это правильно: в `apps/` четыре независимых процесса,
и Railway создаёт по сервису на каждый. Redis из `docker-compose.yml` пока не нужен,
в коде он не используется (понадобится при масштабировании на несколько игровых нод).

| Сервис | Что это | Публичный домен |
| --- | --- | --- |
| `@tg-mmo/client` | статика Mini App | **да** — этот адрес открывает Telegram |
| `@tg-mmo/game-server` | Colyseus, WebSocket | **да** — к нему подключается клиент |
| `@tg-mmo/api` | Fastify, проверка `initData` | **да** — к нему ходит клиент за токеном |
| `@tg-mmo/bot` | grammY, long polling | **нет** — исходящие запросы, порт не слушает |

Плюс плагин **Postgres** из Railway (`+ New` → `Database` → `PostgreSQL`).

## 1. Общие настройки каждого сервиса

Для всех четырёх в **Settings**:

- **Root Directory** — оставить пустым (корень репозитория). Это pnpm-воркспейс,
  установка из подпапки не соберётся.
- **Build Command** — `pnpm install --frozen-lockfile` (клиенту — см. ниже).
- **Start Command** — своя для каждого сервиса.

Чтобы коммит не пересобирал все четыре сервиса, задай **Watch Paths**:

```
client       apps/client/**  packages/shared/**  package.json  pnpm-lock.yaml
game-server  apps/game-server/**  packages/**  package.json  pnpm-lock.yaml
api          apps/api/**  packages/**  package.json  pnpm-lock.yaml
bot          apps/bot/**  packages/shared/**  package.json  pnpm-lock.yaml
```

## 2. Порядок настройки

Домены нужны раньше, чем переменные, поэтому идём так:

**Шаг 1 — game-server и api.** Настрой их первыми и нажми
`Settings → Networking → Generate Domain`. Получишь два адреса вида
`game-server-production-xxxx.up.railway.app`.

### game-server

```
Build Command  pnpm install --frozen-lockfile
Start Command  pnpm start:game
Healthcheck    /health
```

Переменные:

| Переменная | Значение |
| --- | --- |
| `JWT_SECRET` | длинная случайная строка — **та же, что у api** |
| `DEV_LOGIN` | `0` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |

`PORT` Railway подставляет сам, задавать не нужно.

### api

```
Build Command  pnpm install --frozen-lockfile
Start Command  pnpm start:api
Healthcheck    /health
```

| Переменная | Значение |
| --- | --- |
| `BOT_TOKEN` | токен от @BotFather |
| `JWT_SECRET` | **тот же, что у game-server** |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |

Если секреты разойдутся, api выдаст токен, который game-server отвергнет с
`jwt signature invalid` — игрок не сможет войти.

**Шаг 2 — client.** Сгенерируй ему домен и подставь адреса из шага 1.

### client

```
Build Command  pnpm install --frozen-lockfile && pnpm --filter @tg-mmo/client build
Start Command  pnpm start:client
Healthcheck    /
```

| Переменная | Значение |
| --- | --- |
| `API_URL` | `https://<домен api>` |
| `GAME_WS_URL` | `wss://<домен game-server>` — **wss, не ws** |
| `DEV_LOGIN` | `0` |

Клиент читает эти значения в рантайме через `/config.json`, а не из бандла,
поэтому сменить адрес API или игрового сервера — это **перезапуск сервиса,
а не пересборка**. Railway отдаёт HTTPS, а браузер не разрешает `ws://` со
страницы на `https://` — отсюда `wss://`.

**Шаг 3 — bot.**

### bot

```
Build Command  pnpm install --frozen-lockfile
Start Command  pnpm start:bot
Healthcheck    отключить
```

| Переменная | Значение |
| --- | --- |
| `BOT_TOKEN` | тот же токен |
| `WEBAPP_URL` | `https://<домен client>/` |

Бот работает на long polling и не слушает порт, поэтому healthcheck его убьёт.
Домен ему тоже не нужен.

## 3. Миграции

Один раз, локально, против публичного адреса базы (Railway показывает его в
плагине Postgres как `DATABASE_PUBLIC_URL`):

```bash
DATABASE_URL="postgres://...@...proxy.rlwy.net:PORT/railway" pnpm db:push
```

Без этого игра запустится, но прогресс сохраняться не будет — сервер
пишет ошибку в лог и продолжает работать в памяти.

## 4. Подключить к Telegram

В @BotFather: `/mybots` → бот → `Bot Settings` → `Menu Button` → адрес клиента.
Затем `/start` в боте — кнопка «Играть» откроет Mini App.

## Если что-то не работает

| Симптом | Причина |
| --- | --- |
| Белый экран, в консоли `WebSocket failed` | `GAME_WS_URL` с `ws://` вместо `wss://`, либо у game-server нет домена |
| «Не удалось авторизоваться (401)» | разные `JWT_SECRET` у api и game-server, или неверный `BOT_TOKEN` |
| «Открой игру через Telegram» вне Telegram | так и задумано при `DEV_LOGIN=0` |
| bot-сервис бесконечно перезапускается | включён healthcheck — отключи |
| Прогресс не сохраняется | не выполнен `pnpm db:push`, либо не проставлен `DATABASE_URL` |
| Сборка падает на `pnpm install` | задан Root Directory — убери, нужен корень репозитория |
