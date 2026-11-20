#!/usr/bin/env bash
# Usage: notify.sh <event>   (hook JSON on stdin)
# Sends one KDE notification for <event>, honoring the per-event settings from
# System Settings > Notifications > Claude Code (popup on/off, sound on/off
# and which sound).
ev=$1
root=${CLAUDE_PLUGIN_ROOT:-$(dirname "$0")/..}
rc=claude-code.notifyrc
dst=${XDG_DATA_HOME:-$HOME/.local/share}/knotifications6
user=${XDG_CONFIG_HOME:-$HOME/.config}/$rc

# cfg <key>: value of <key> for this event; the user's choice wins over the
# shipped default. Needed because Plasma applies per-event settings only inside
# apps that link KNotifications; for plain D-Bus senders we must do it here.
# (kreadconfig6 cannot tell "Action=" (all off) from a missing key.)
cfg() {
    local f v
    for f in "$user" "$root/share/$rc"; do
        v=$(awk -v s="[Event/$ev]" -v k="$1" '
            $0 == s { f = 1; next }  /^\[/ { f = 0 }
            f && index($0, k "=") == 1 { print "=" substr($0, length(k) + 2); exit }
        ' "$f" 2>/dev/null)
        [ -n "$v" ] && { printf '%s\n' "${v#=}"; return; }
    done
}

# play <sound>: a file path/URL, or a name looked up in the sound themes.
play() {
    local s=${1#file://} t e
    [ -n "$s" ] || return
    if [ "${s#/}" = "$s" ]; then
        for t in "$(kreadconfig6 --file kdeglobals --group Sounds --key Theme 2>/dev/null)" ocean freedesktop; do
            for e in oga ogg wav; do
                [ -f "/usr/share/sounds/$t/stereo/$s.$e" ] &&
                    { s=/usr/share/sounds/$t/stereo/$s.$e; break 2; }
            done
        done
    fi
    paplay "$s" 2>/dev/null
}

# Self-install the event definitions: this is what lists the events in
# System Settings. User choices live in ~/.config, so updates keep them.
cmp -s "$root/share/$rc" "$dst/$rc" ||
    { mkdir -p "$dst" && cp "$root/share/$rc" "$dst/$rc"; }

# Lines: project folder, tool name, best available text (one line, <=160).
{ read -r proj; read -r tool; read -r msg; } < <(jq -r '
    (.cwd // "" | split("/") | last),
    (.tool_name // ""),
    ((.message // .last_assistant_message // .error // .reason
      // .tool_input.command // .tool_input.file_path
      // .tool_input.questions[0].question // .tool_input.plan // "")
     | tostring | gsub("\\s+"; " ") | .[0:160])' 2>/dev/null)

# PermissionRequest fires only when a dialog is shown, also for these two tools.
if [ "$ev" = permission ]; then
    case $tool in
        AskUserQuestion) ev=question ;;
        ExitPlanMode) ev=plan ;;
        *) msg="${tool:+$tool: }$msg" ;;
    esac
fi

case $ev in
    response)   t='Response ready';      u=normal;   i=dialog-ok ;;
    permission) t='Permission needed';   u=critical; i=dialog-warning ;;
    question)   t='Question for you';    u=critical; i=dialog-question ;;
    plan)       t='Plan ready';          u=critical; i=document-edit ;;
    idle)       t='Waiting for you';     u=normal;   i=preferences-system-time ;;
    subagent)   t='Subagent finished';   u=low;      i=system-run ;;
    error)      t='Request failed';      u=critical; i=dialog-error ;;
    denied)     t='Action denied';       u=normal;   i=dialog-cancel ;;
    *) exit 1 ;;
esac

action=$(cfg Action)
case $action in *Popup*)
    notify-send -a 'Claude Code' -u "$u" -i "$i" \
        -h string:x-kde-appname:claude-code -h "string:x-kde-eventId:$ev" \
        "$t" "${proj:+$proj: }${msg:-$t}" ;;
esac
case $action in *Sound*) play "$(cfg Sound)" ;; esac
