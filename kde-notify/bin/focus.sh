#!/usr/bin/env bash
# Usage: focus.sh <title hint> <pid>...
# Activates the window of the first <pid> that owns one (pass the nearest
# ancestor first). One process may own many windows (Konsole, VS Code), so
# among them a title containing <title hint> wins. Done by a KWin script:
# KWin does not apply focus stealing prevention to it, so it works on Wayland.
[ -n "$XDG_RUNTIME_DIR" ] || exit 1
# The hint becomes a JS string literal; jq escapes it against script injection.
hint=$(jq -n --arg s "$1" '$s') || exit 1
shift
pids=$(printf '%s\n' "$@" | grep -x '[0-9]\+' | paste -sd,)
[ -n "$pids" ] || exit 1
dir=$XDG_RUNTIME_DIR/kde-notify
js=$dir/focus.js
name=kde-notify-focus
scripting() {
    gdbus call --session --dest org.kde.KWin --object-path /Scripting \
        --method "org.kde.kwin.Scripting.$1" "${@:2}"
}

# The script unloads itself at its end: KWin reads the file asynchronously
# after "run", so unloading it from here would race that read.
mkdir -p "$dir" && cat > "$js" <<EOF || exit 1
const pids = [$pids], hint = $hint;
let best = null, rank = pids.length, named = false;
for (const w of workspace.windowList()) {
    const r = pids.indexOf(w.pid), m = hint !== "" && w.caption.includes(hint);
    if (w.normalWindow && r >= 0 && (r < rank || (r == rank && m && !named))) {
        best = w; rank = r; named = m;
    }
}
if (best) { best.minimized = false; workspace.activeWindow = best; }
callDBus("org.kde.KWin", "/Scripting", "org.kde.kwin.Scripting", "unloadScript", "$name");
EOF

# A leftover instance (e.g. KWin restarted mid-run) would make loadScript fail.
scripting unloadScript "$name" >/dev/null 2>&1
n=$(scripting loadScript "$js" "$name" 2>/dev/null) || exit 1
n=${n#(}; n=${n%%,*}; n=${n##* }   # "(N,)" or "(int32 N,)" -> N
[ "$n" -ge 0 ] 2>/dev/null || exit 1
gdbus call --session --dest org.kde.KWin --object-path "/Scripting/Script$n" \
    --method org.kde.kwin.Script.run >/dev/null
