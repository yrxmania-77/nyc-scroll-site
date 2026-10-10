# HANDOFF — Cowork ↔ Claude Code

Общая доска двух агентов. Cowork — ведёт (план, ревью, задачи). Claude Code — исполняет.
Создано: 2026-10-01 09:53

## 📥 Inbox — задачи от Cowork
<!-- Cowork пишет сюда задачи. Claude Code: выполни, затем перенеси в Done с итогом. -->

### [2026-10-10 cowork] TASK 2 — зачистка стекла/glow  ⚠️ есть конфликт, см. Issues
(FPS-часть этой задачи закрыта: blur не был причиной тормозов, 120fps без правок. Осталась эстетика — и она спорит с project CLAUDE.md.)
### исходная формулировка: зачистка стекла/glow (постоянное правило: никакого glassmorphism/blur/glow/неона)
grep -n по css/js на backdrop-filter, blur(, box-shadow с цветным свечением, "frosted/glass" — nav pill, форма Get in Touch, карточки, кнопки. Заменить на матовые светлые плоские поверхности (solid/полупрозрачный без blur), без свечения. Без редизайна остального. Проверить 1 contact sheet (nav + форма + карточка).

### [2026-10-10 cowork] TASK 3 — проверки без правок (результат в Log/Issues)
- Day/Night слайдер Times Square: обе картинки одного кадрирования, слайдер широкий, eyebrow «NEW YORK».
- Nav не налезает на заголовок Get in Touch.
- 4 удалённых исходных PNG (scroll-start, skyline, street-food, get in touch background pic): `git log --diff-filter=D` — кто/когда; если они нужны media-pipeline.sh, восстановить из git, если нет — записать в Issues.

### Ограничения токенов (для всех задач выше)
Читать диапазоны (grep -n → sed -n / Read offset+limit), файлы >300 строк целиком не читать; точечные правки, не полные переписывания; не перечитывать неизменённое; в shell печатать только нужное; скриншоты: кроп/один contact sheet, ≤6 на задачу, не открывать повторно просмотренное; максимум 2 раунда fix-and-check на проблему, потом отчёт; на 50% окна контекста — авто-сброс и продолжение самому, прогресс в HANDOFF.

### ⏸ Ждёт решения пользователя (НЕ делать без ответа)
- Pinned scrubbed journey vs правило «без длинных pin»: оставить как исключение для этого сайта или переделать.


## ✅ Done
<!-- Claude Code: - [дата] задача → итог (файлы) -->
- **[2026-10-09] ПРИОРИТЕТ №1 + TASK 1 — доставка journey через H.264/WebCodecs доведена и проверена.**
  Было: 968 JPEG, 184–389MB, на 10 Mbps доезжало 1.8 из 8 клипов, лоадер 90% пина, страница расцеплялась на месте 1.
  Стало (локально, `delivery-check.py`, 30-сек скролл 600px/s, кэш выключен):
  | канал | тир | клипов доехало | лоадер | карточки | байт |
  |---|---|---|---|---|---|
  | 10 Mbps | lo | 8/8 (121 кадр каждый) | **0% пина** | 4/4 | 22MB |
  | unthrottled | hq | 8/8 | **0% пина** | 4/4 | 51MB |
  Плавность (rAF-счётчик, оба канала): **median 8.3ms = 120fps**, p95 9.2–9.3ms, кадров >20ms — 0.0% (1–2 из ~4540).
  Память: живых ImageBitmap пик 49–60 → 14 в конце (rolling window закрывает), heap 92MB (hq) / 23MB (lo), в конце == пик. Вылетов и page errors нет.
  Штатные проверки: `scroll-check` desktop 0/1032 дропов, mobile 1/1019; `boundary-check` OK (median 16.78, ни одного пика); `shape-check` OK. JPEG-фолбэк (`?video=off`) по-прежнему проигрывает journey целиком.
  **Найдено и исправлено по ходу:** тир выбирался по `navigator.connection.downlink`, а это скользящее среднее ПРЕДЫДУЩЕЙ сети — на холодной загрузке Chrome отдавал <10, и из-за односторонней лестницы это было навсегда: на сервере 1.7GB/s journey играл 1280×720, растянутые на canvas 2880px. Теперь проба, измерив канал, может один раз поднять тир — только до потолка устройства и только пока ничего не нарисовано (`active === false`), так что мигания разрешений нет, а в середине journey лестница по-прежнему только вниз.
  Файлы: `js/journey.js`, `index.html` (GSAP самохостом), `js/vendor/`, `scripts/video-pipeline.sh`, `scripts/video-index.py`, `scripts/delivery-check.py`, `scripts/boot-profile.py`, `.github/workflows/pages.yml`, `main scroll folder/video/` (hq/sm/lo + manifest, 90MB).

## 🔧 Status
<!-- Claude Code держит актуальным: что работает, что в процессе, стек/запуск. -->
- **Journey доставляется и на медленном канале.** Доставка — raw H.264 на клип в трёх тирах (hq/sm/lo) + `video/manifest.json` с байтовыми диапазонами кадров, декод через WebCodecs; JPEG-кадры остались фолбэком для браузеров без WebCodecs.
- **Для записи видео — одна команда:**
  ```
  python3 "NYC Folder/scripts/serve.py"
  ```
  → `http://localhost:8080/NYC%20Folder/index.html?tier=hq`
  `?tier=hq|sm|lo` прикалывает тир намертво (ни проба, ни `#checkPace` его не двигают) — на localhost это гарантирует самый резкий из существующих кадров. Без параметра тир тоже поднимется до hq, но только после пробы, то есть первые ~2.5s играет sm.
- **Не запушено.** Всё закоммичено локально; `main scroll folder/video/` — 61 файл / 90MB, жду подтверждения пользователя на push (см. Issues).

## ⚠️ Issues
<!-- Нерешённые ошибки: симптом → причина (если известна) → что уже пробовали. -->
- **ЖДЁТ ПОЛЬЗОВАТЕЛЯ: push 90MB.** `main scroll folder/video/` = 61 файл / 90MB уходит в историю git навсегда (репо уже ~770MB против мягкого лимита GitHub 1GB). Pages workflow уже собирает `video/` и проверяет 8 клипов на тир + манифест. Live не проверен, потому что без push проверять нечего.
- **ЖДЁТ ПОЛЬЗОВАТЕЛЯ: TASK 2 спорит с project CLAUDE.md.** Правило Cowork — «никакого glassmorphism/blur/glow». Но `NYC Folder/CLAUDE.md` описывает карточку в Contact как намеренный glassmorphism-минус-тень, с измеренными токенами (`--glass` 0.85 даёт +0.6 luma, `--scrim` 0.14 даёт +21 luma, `--glass-edge` перевёрнут в чернильный) — это не вкусовщина, а подогнанные числа под светлую фотографию. Ломать их молча нельзя. Нужно решение: оставить Contact как есть и зачистить остальное, или переписать и эту секцию.
  Перф-аргумент из задачи при этом закрыт замером: blur не стоил ничего, скролл 120fps **до** любой зачистки.
- Working tree has 4 source PNGs deleted (scroll-start, skyline, street-food, get in touch background pic). Site unaffected (derivatives exist), but media-pipeline.sh can no longer regenerate them. Unknown whether deletion is intentional.

## 📜 Log
<!-- - YYYY-MM-DD HH:MM [claude-code|cowork] что сделано -->
- 2026-10-01 11:06 [claude-code] Diagnosed slow/cutting journey: bandwidth-bound (968 JPEGs, 184–389MB); reproduced live + throttled local; no code changed.
- 2026-10-10 03:20 [cowork] Inbox: TASK 1 (довести/проверить H.264 доставку), TASK 2 (зачистка glass/glow), TASK 3 (проверки слайдера/nav/удалённых PNG). LOCK от 10-01 11:40 был stale — не трогал код.
- 2026-10-10 03:25 [cowork] Поднят приоритет №1: тормозящий скролл на live → TASK 1 + замер FPS + blur-слои.
- 2026-10-09 18:05 [claude-code] H.264/WebCodecs доставка доведена и замерена: 10 Mbps → 8/8 клипов, лоадер 0%, 22MB; unthrottled → hq, 51MB; 120fps оба канала, утечек нет. Исправлен выбор тира по стылому downlink. Закоммичено, НЕ запушено (90MB, жду ок).
