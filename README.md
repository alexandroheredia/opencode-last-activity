# opencode-last-activity

OpenCode TUI plugin that shows a relative last-activity indicator in `session_prompt_right` so you can tell whether the current session is active, waiting, retrying, or possibly stalled.

## Features

- shows `active now` while work is happening
- shows `last activity 8s ago` when the session is idle
- shows `waiting on permission` and `waiting on question` when input is blocked
- shows `possibly stalled 2m ago` when the session stays busy without recent activity
- optional compact mode for tighter prompt layouts

## Install

Install the package with OpenCode:

```sh
opencode plugin @alexandroheredia/opencode-last-activity
```

Then quit and restart OpenCode.

## Manual Config

If you prefer to edit `tui.json` directly:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "@alexandroheredia/opencode-last-activity",
      {
        "compact": false,
        "activeWindowMs": 5000,
        "stalledWindowMs": 60000
      }
    ]
  ]
}
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `compact` | `boolean` | `false` | Uses shorter labels such as `active`, `2m ago`, and `stalled 2m ago`. |
| `activeWindowMs` | `number` | `5000` | Age threshold that still counts as active. |
| `stalledWindowMs` | `number` | `60000` | Age threshold for switching a busy session to stalled. |

If `stalledWindowMs` is set lower than `activeWindowMs`, the plugin automatically pushes it above the active window so labels stay sane.

## Label Examples

Full mode:

- `active now`
- `last activity just now`
- `waiting on permission`
- `waiting on question`
- `retrying 12s ago`
- `possibly stalled 3m ago`

Compact mode:

- `active`
- `just now`
- `permission`
- `question`
- `retry 12s ago`
- `stalled 3m ago`

## Development

This section is for maintainers and contributors.

```sh
npm install
npm run typecheck
```

For local testing before publishing, point your `~/.config/opencode/tui.json` at your local checkout and replace the placeholder path below with the real absolute path on your machine:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": [
    [
      "/absolute/path/to/opencode-last-activity/src/tui.tsx",
      {
        "compact": false
      }
    ]
  ]
}
```

Quit and restart OpenCode after changing plugin config.