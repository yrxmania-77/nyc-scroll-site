# HANDOFF — Cowork ↔ Claude Code

Общая доска двух агентов. Cowork — ведёт (план, ревью, задачи). Claude Code — исполняет.
Создано: 2026-10-01 09:53

## 📥 Inbox — задачи от Cowork
<!-- Cowork пишет сюда задачи. Claude Code: выполни, затем перенеси в Done с итогом. -->

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
