#!/usr/bin/env bash
# Usage: dismiss.sh <event>... | all   (hook JSON on stdin)
# Closes this session's popups for the given events, using the IDs saved by
# notify.sh. "all" closes every popup of the session and forgets it.
sid=$(jq -r '.session_id // ""' 2>/dev/null)
case $sid in ''|*[!A-Za-z0-9-]*) exit 0 ;; esac
[ -n "$XDG_RUNTIME_DIR" ] || exit 0
dir=$XDG_RUNTIME_DIR/kde-notify/$sid

if [ "$1" = all ]; then files=("$dir"/*); else files=("${@/#/$dir/}"); fi
for f in "${files[@]}"; do
    # rm before closing: a concurrent notify.sh then starts a fresh popup
    # instead of replacing the one being closed.
    [ -f "$f" ] && read -r id < "$f" && rm -f "$f" || continue
    gdbus call --session --dest org.freedesktop.Notifications \
        --object-path /org/freedesktop/Notifications \
        --method org.freedesktop.Notifications.CloseNotification "$id" >/dev/null 2>&1
done
[ "$1" = all ] && rmdir "$dir" 2>/dev/null
exit 0
