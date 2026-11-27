# kde-notify

KDE Plasma notifications for Claude Code. Every situation is its own notification event, so Plasma lets you control each one separately: popup, sound, history, Do Not Disturb behavior and more.

## Events

| Event | Fires when |
|---|---|
| Response ready | Claude finishes a response. |
| Permission needed | A permission dialog is shown for a tool. Nothing is sent when a tool is allowed automatically. |
| Question for you | Claude asks you a question (a dialog for `AskUserQuestion`, or an MCP elicitation). |
| Plan ready | Claude asks you to approve a plan. |
| Waiting for you | The session is idle and waits for input. |
| Subagent finished | A subagent completes. |
| Request failed | A request ends with an API error. |
| Action denied | An action is denied automatically (for example by auto mode). |

## Automatic dismissal

Each session keeps at most one popup per event: a new one replaces the previous one. Popups that only matter until you react are closed for you.

| Event | Closed when |
|---|---|
| Permission needed, Question for you, Plan ready | A tool finishes or fails, an MCP elicitation is answered, Claude finishes a response, or you send a message. |
| Response ready, Waiting for you | You send a message. |

All popups of a session are closed when the session ends.

## Requirements

KDE Plasma 6, `notify-send` (libnotify), `gdbus` (GLib), `paplay` and `jq`.

## Installation

```sh
claude plugin marketplace add /path/to/claude-plugins
claude plugin install kde-notify@qol-mods
```

The first notification installs the event definitions to `~/.local/share/knotifications6/claude-code.notifyrc`. After that, open System Settings, Notifications, Claude Code, and press "Configure Events..." to tune each event. Your choices are stored in `~/.config/claude-code.notifyrc` and survive plugin updates.

Plasma applies per-event settings only inside applications that link its notification library, so the plugin reads that file itself: it honors "Show a message in a popup" and "Play a sound" (including the chosen sound). Application-wide settings, such as history and Do Not Disturb behavior, are applied by Plasma.

## Uninstallation

```sh
claude plugin uninstall kde-notify@qol-mods
rm ~/.local/share/knotifications6/claude-code.notifyrc ~/.config/claude-code.notifyrc
```
