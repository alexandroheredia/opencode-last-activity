# Contributing

## Development

```sh
npm install
npm run typecheck
```

## Local Testing

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

Restart OpenCode after changing plugin config.
