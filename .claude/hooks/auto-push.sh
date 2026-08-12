#!/usr/bin/env bash
# Stop hook: keep the deployed site current.
#
# Runs after every task. Stages, commits and pushes so GitHub Pages redeploys
# without anyone having to remember. Silent when there is nothing to do.
#
# Two things it deliberately does NOT do:
#
#   - It does not invent a description of the change. A shell script cannot know
#     what was edited or why. When Claude commits during the task it writes a
#     real message; this only catches what was left uncommitted, and labels it
#     as such rather than pretending to be descriptive.
#
#   - It does not push a frame re-export. `media-pipeline.sh` rewrites 1,936
#     files and ~570MB, and this repository is already ~770MB against GitHub's
#     1GB soft warning. Auto-pushing that would burn a third of the remaining
#     headroom permanently, in history, unattended. Over the threshold it
#     unstages and asks for a human.

set -uo pipefail

REPO="/Users/procct/The New York site"
MAX_FILES=200          # a frame re-export is 1936; ordinary edits are single digits

cd "$REPO" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

git add -A >/dev/null 2>&1

staged=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')

# Nothing new, but there may be commits made during the task that never went up.
if [ "$staged" -eq 0 ]; then
  ahead=$(git rev-list --count @{u}..HEAD 2>/dev/null || echo 0)
  [ "$ahead" -eq 0 ] && exit 0
  if git push -q 2>/dev/null; then
    printf '{"systemMessage":"Pushed %s commit(s) — GitHub Pages will redeploy."}\n' "$ahead"
  else
    printf '{"systemMessage":"Auto-push failed. Run: git push"}\n'
  fi
  exit 0
fi

if [ "$staged" -gt "$MAX_FILES" ]; then
  git reset -q
  printf '{"systemMessage":"Auto-push SKIPPED: %s files changed (threshold %s). This looks like a frame re-export, which would add ~570MB to history permanently. Commit it deliberately if that is what you want."}\n' \
    "$staged" "$MAX_FILES"
  exit 0
fi

summary=$(git diff --cached --name-only | head -3 | xargs -n1 basename 2>/dev/null | paste -sd, - 2>/dev/null)
[ "$staged" -gt 3 ] && summary="$summary +$((staged - 3)) more"

git commit -q -m "Update site: ${summary}" >/dev/null 2>&1 || exit 0

if git push -q 2>/dev/null; then
  printf '{"systemMessage":"Committed and pushed %s file(s): %s — GitHub Pages will redeploy."}\n' "$staged" "$summary"
else
  printf '{"systemMessage":"Committed %s file(s) but the push failed. Run: git push"}\n' "$staged"
fi
exit 0
