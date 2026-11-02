# SOOT STUDIO — 1930s animation studio site (Cuphead style)

Минималистичный **многостраничный** сайт анимационной студии «Soot Studio» в духе игры **Cuphead** (эпохи Fleischer/Disney 1920–30-х): бумага, тушь, штампы, hard shadows — без градиентов, блюра и «нейро-стекла».

## Как открыть
**С сервером (полный опыт):** в этой папке `npm install` (один раз) → `npm start` → http://localhost:3188
Нужна запущенная служба PostgreSQL — «сейф» хранит телеграфы, счётчик гостей и рекорды парри.

**Без сервера:** откройте `index.html` в браузере — сайт полностью работает, но функции сейфа тихо отключаются (стойка проводов держит заглушку, гостевой № и домовой рекорд не показываются).

## Структура (5 отдельных страниц)
```
soot-studio/
├── index.html         — №1 Main page: интро-заставка + hero
├── work.html          — №2 THE SHOWREEL: мультфильмы Fleischer/Disney/Iwerks (паблик-домейн)
├── about.html         — №3 THE PORTRAIT: история, команда, «дома-кумиры» + гостевой №
├── capabilities.html  — №4 THE INKWELL INVENTORY: цепочка навыков + этапы + мастерские
├── contact.html       — №5 THE TELEGRAPH OFFICE: телеграф-форма «KNOCKOUT!» + стойка проводов
├── film.html          — картотека фильмов (film.html?f=slug)
├── 404.html           — «THE LOST REEL» (сервер отдаёт её на любых 404)
├── css/style.css      — стиль: плоские цвета, жёсткие тени, без градиентов
├── js/main.js         — движок: переходы-вайпы, горизонтальный скролл, lazy-load, интро, звук
├── server.js          — Express-сервер: статика + API сейфа (PostgreSQL)
├── package.json       — npm run build (проверка синтаксиса) / npm start = node --env-file-if-exists=.env server.js
├── neon.ts            — политика Neon-сервисов (postgres): `neon deploy` провижинит их и подтянет DATABASE_URL в .env
├── read-wires.mjs     — локальный «ящик стола»: открыть запечатанные адреса проводов
├── .env               — PORT + DATABASE_URL + WIRE_KEY (секреты, в git не попадают)
└── assets/            — ассеты из интернета (вики Cuphead / Fandom / wiki.gg, © StudioMDHR — как трибьют)
```

## Что внутри
- **Многостраничность**: 5 отдельных `.html`-файлов, каждый — своя «плёнка» (панель) с горизонтальным скроллом.
- **Плейсхолдер-интро** (только главная): Cuphead стреляет по цветку Cagney Carnation; три попадания — мини-взрыв кадрами из игры (Flower Cloud Bomb), вспышка, тряска — и логотип штампуется по буквам.
- **Горизонтальный скроллинг** на каждой странице: колесо, drag, стрелки ←/→, Home/End.
- **Вертикальный левый «рельс»**: повёрнутое меню, счётчик «REEL 0X/05», розовая пуля-пасхалка.
- **Переход между страницами**: чернильная клякса-вайп из точки клика (SVG blob, steps()-кадрирование как в старой анимации).
- **Работы реальных студий** (стр. Work): Snow-White 1933 (Fleischer), Steamboat Willie 1928 (Disney/Iwerks), Popeye Meets Sindbad 1936 (Fleischer Technicolor), Minnie the Moocher 1932, Balloon Land 1935 (Ub Iwerks) — всё в паблик-домейне; плюс «Night School» из локального mp4.
- **Capabilities**: цепочка навыков (без наложений) + разделы «HOW A PICTURE GETS MADE» и «THE HOUSE TOOLS».
- **Персонажи живут**: bob / march / float / blink keyframes.
- **Lazy-loading**: картинки и видео подгружаются при приближении (свой rAF-лоадер под горизонтальный скролл, т.к. IntersectionObserver в transform-контейнере не работает).
- **Звук**: WebAudio-синтезированные сигналы (выстрел/клик/парри/бум), после первого жеста.
- Пасхалка whoisguilty.com в About: «аниматоры и разработчики разговаривают ДО кадра».
- `prefers-reduced-motion` поддержан.

## Сервер и база (server.js)
Node.js + Express 5, база PostgreSQL 18. API живёт до статики, 404-маршруты отдают `404.html`:

| Метод | Путь | Что делает |
|---|---|---|
| GET | `/api/wire` | последние 8 телеграмм — стойка «THE WIRE LOG» на Contact |
| POST | `/api/wire` | принять телеграмму (имя ≤40, e-mail ≤120 — шифруется AES-256-GCM, на стойке видна только маска, текст ≤500) |
| POST | `/api/visit` | засчитать визит браузера (1 на `sid` из localStorage) → «GUEST №» на About |
| GET | `/api/parry` | домовой рекорд парри-миниигры |
| POST | `/api/parry` | записать комбо в домовую стену; новый рекорд — мегафон объявляет |
| GET | `/api/health` | жив ли проектор (`{ok, pid, up}`) |

Таблицы в базе `soot_studio`: `wires(name, body, created_at)`, `visits(session_id UNIQUE)`, `parry_scores(name, score CHECK>=0)`.

Запуск:
- В корне проекта `.env`: `PORT=3188`, `DATABASE_URL` (по умолчанию — облачный сейф **Neon**, ветка `production`; для чисто локальной базы подставь свой URL вида `postgres://soot:…@127.0.0.1:5432/soot_studio`, роль `soot` — только SELECT/INSERT) и `WIRE_KEY` (ключ AES-256-GCM).
- `npm start` → http://localhost:3188. База легла — API отвечает 503 «the vault desk is closed», сайт продолжает работать без сейфа.

### Как заглянуть в сейф
- **Самый простой** — «ящик стола» (сам читает `.env`, показывает провода и вскрывает запечатанные адреса):
  ```
  node --env-file=.env read-wires.mjs
  ```
- **Через psql** (пароль администратора postgres — твой личный, в README его писать нельзя):
  ```powershell
  $env:PGPASSWORD='<твой пароль postgres>'
  & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U postgres -d soot_studio -c "SELECT id, name, email, body, created_at FROM wires ORDER BY id DESC LIMIT 10;"
  ```
- **Через pgAdmin** (если установлен): сервер PostgreSQL 18 → база `soot_studio` → Schemas → public → Tables → `wires` / `visits` / `parry_scores` → ПКМ → View/Edit Data → All Rows.

Каждый стук по API пишется в лог сервера (`POST /api/wire -> 201` — файл `.server-log` рядом с проектом).

## Деплой бесплатно (Render + Neon)
Всё живёт на $0 и без карты: сайт + API — **Render** (web service), база — **Neon** (проект «Soot-Studio», ветка `production`).

**Neon уже подключён**: в корне лежит `neon.ts` — политика сервисов (только Postgres, `auth: false`). Облачные команды:
```
neon deploy      # провижинит сервисы из neon.ts и подтянет DATABASE_URL + DATABASE_URL_UNPOOLED в .env
npm run build    # проверка синтаксиса перед выкладкой
npm start        # три таблицы строятся сами при первом старте (auto-ensure в server.js)
```

1. Залей код на GitHub (`.env`, `.env.local`, `.env.bak`, `.pg-admin.txt`, `node_modules`, `.server-*` в git не попадают — прикрывает `.gitignore`).
2. **Render** (render.com, без карты): New → Web Service → подключи GitHub-репозиторий:
   - Build command: `npm install`
   - Start command: `npm start`
   - Environment variables:
     | Ключ | Значение |
     |---|---|
     | `DATABASE_URL` | строка из Neon (уже лежит в локальном `.env`) |
     | `WIRE_KEY` | тот же ключ, что в локальном `.env` |
   - `PORT` Render подставит сам, `HOST` сервер сам переводит на `0.0.0.0` (видит флаг `RENDER=true`).
3. SQL руками писать не нужно — при первом старте сервер сам строит таблицы.

Нюансы бесплатности: Render засыпает после 15 минут тишины (первое открытие будит его около минуты); Neon уходит в scale-to-zero и просыпается на первом запросе. Секреты (`WIRE_KEY`, пароль базы) в git не попадают — их вводят только в дашбордах.

Безопасность: служебные файлы (`.env`, `.server-*`, `node_modules`, `package.json`, `read-wires.mjs`) сервером не раздаются; текст гостя рендерится только через `textContent` (XSS невозможен); частота запросов ограничена в памяти на IP (провода 3/мин, визиты 30/мин, парри 6/мин).

E-mail гостя хранится дважды: **маска** (`op*****@1934.reel`) — для стойки, и **шифртекст** AES-256-GCM (`email_enc`, ключ `WIRE_KEY` из `.env`) — для хозяина. Открыть запечатанные адреса можно только локально:
```
node --env-file=.env read-wires.mjs
```

 © Cuphead — StudioMDHR; сайт — некоммерческий фан-трибьют.
