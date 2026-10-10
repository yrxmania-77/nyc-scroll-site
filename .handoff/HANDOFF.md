# HANDOFF — Cowork ↔ Claude Code

Общая доска двух агентов. Cowork — ведёт (план, ревью, задачи). Claude Code — исполняет.
Создано: 2026-10-01 09:53

## 📥 Inbox — задачи от Cowork
<!-- Cowork пишет сюда задачи. Claude Code: выполни, затем перенеси в Done с итогом. -->

### [2026-10-10 cowork] TASK 1 — довести доставку journey (H.264/WebCodecs) до конца, проверить, закоммитить
Контекст: в рабочем дереве незакоммичено твоё: journey.js (+625), scripts/video-pipeline.sh, video-index.py, delivery-check.py, js/vendor/, main scroll folder/video/ (hq/sm/lo + manifest, 90MB), pages.yml, index.html. Статуса "готово/проверено" в Log нет.
1. Проверь, что реализация цельная: выбор тира hq/sm/lo по измеренному каналу, JPEG-фолбэк без WebCodecs, ни одного кадра не рисуется до прихода, hold/stations/gate готовности не сломаны.
2. Замер: localhost throttled 10 Mbps, 30-сек скролл нормальным темпом (не флинг) → все 8 клипов доходят, лоадер не висит, страница не расцепляется на месте 1. Плюс unthrottled: 60fps, без регрессий.
3. Размер репо: video/ 90MB уходит в git — ок, но НЕ пушить молча; если >250 файлов или >100MB — спроси подтверждение. Проверь, что Pages workflow собирает/кладёт video/ и не требует старых frames в истории.
4. Коммит (без -A, только нужные файлы), push ты, при ConnectionRefused — ретрай, затем доложи "committed-not-pushed" + команду.
5. Занеси итог в Done/Status, убери закрытое из Issues.

### [2026-10-10 cowork] TASK 2 — зачистка стекла/glow (постоянное правило: никакого glassmorphism/blur/glow/неона)
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

## 🔧 Status
<!-- Claude Code держит актуальным: что работает, что в процессе, стек/запуск. -->
- Journey code is healthy: on unthrottled localhost (scripts/serve.py) all 8 clips arrive, 60fps, loader never shows.
- Journey FAILS on any link under ~50 Mbps: it is bandwidth-bound (see Issues). Not fixed yet — awaiting user's choice of fix.

## ⚠️ Issues
<!-- Нерешённые ошибки: симптом → причина (если известна) → что уже пробовали. -->
- **Journey "crazy slow, barely loads, cuts midway"** → cause: bytes vs bandwidth. Journey = 968 JPEGs, 184MB (frames-sm) / 389MB (frames).
  Measured 2026-10-01, 30s scroll at 600px/s: live site on this Mac's ~10 Mbps → only park-dive + 104/121 park-pullup arrived, loader up ~90% of the pin,
  page unpinned with journey stuck at place 1 (hold stands down while waiting on network = the "cut"). Localhost throttled to 10 Mbps: identical failure.
  Localhost unthrottled: perfect. So NOT a localhost issue, and deploying to a domain will NOT fix it.
  Size test on park-dive: frames 47.7MB, frames-sm 23.9MB, H.264 720p gop12 8.2MB, H.264 960x540 crf23 gop12 3.5MB (≈28MB whole journey).
  Proposed: replace frame sequence with per-clip H.264 decoded via WebCodecs (or video seek) → ~7–14x fewer bytes. Not started.
- Working tree has 4 source PNGs deleted (scroll-start, skyline, street-food, get in touch background pic). Site unaffected (derivatives exist), but media-pipeline.sh can no longer regenerate them. Unknown whether deletion is intentional.

## 📜 Log
<!-- - YYYY-MM-DD HH:MM [claude-code|cowork] что сделано -->
- 2026-10-01 11:06 [claude-code] Diagnosed slow/cutting journey: bandwidth-bound (968 JPEGs, 184–389MB); reproduced live + throttled local; no code changed.
- 2026-10-10 03:20 [cowork] Inbox: TASK 1 (довести/проверить H.264 доставку), TASK 2 (зачистка glass/glow), TASK 3 (проверки слайдера/nav/удалённых PNG). LOCK от 10-01 11:40 был stale — не трогал код.
