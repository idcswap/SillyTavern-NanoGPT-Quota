# NanoGPT Quota for SillyTavern

A small subscription quota widget beside the message box. Hover, focus or click the gauge to see weekly input tokens used/remaining, the account's limit and the reset time. Click also works on phones. Interface language: Russian.

![License: MIT](https://img.shields.io/badge/license-MIT-blue)

## Install

Requires **SillyTavern 1.19.0 or newer with the `/api/nanogpt/credits` endpoint** and a NanoGPT API key already saved in ST's API settings.

In **Extensions → Install extension**, paste:

```text
https://github.com/idcswap/SillyTavern-NanoGPT-Quota
```

Reload the page. The gauge appears beside the message input, on its left. No extra API key, server plugin, CORS proxy or Node dependencies are needed. No changes to SillyTavern core files are required.

## How it works

- Uses ST's existing server-side NanoGPT credits endpoint. Your saved key stays on the ST server; this extension never reads or sends a key from the browser.
- Shows **account-wide subscription input-token quota**, not tokens in this conversation, output tokens, or remaining model context.
- Limits and reset times come from NanoGPT. Nothing is hardcoded to a particular subscription plan. Reset time uses the browser's local timezone.
- Refreshes on startup, every five minutes while the tab is visible, when opening an old tooltip, and after generation. Automatic requests are spaced at least one minute apart. Manual refresh is limited to once per 15 seconds. No model-generation requests are made.
- The badge shows percent **remaining**. The progress bar shows percent **used**. It warns at 75% used and turns pink at 90% used.
- Network failures retain the last successful snapshot with a warning. Missing or inconsistent counters show unknown; they do not become a full allowance. Daily tokens are shown only when a meaningful daily quota is returned.
- Supports keyboard focus, Escape, touch, small screens, reduced motion, and ST theme colors. Opening the widget doesn't block generation or edit chat/settings files.

NanoGPT's official [Subscription Usage API](https://docs.nano-gpt.com/api-reference/endpoint/subscription-usage) documents the quota fields. ST's built-in route combines this with a balance check and normalizes the response. Its `percentUsed` is a fraction; the widget derives its percentage from `used / limit`. The built-in route does not preserve every upstream degraded-data flag, so empty/inconsistent normalized buckets are rejected conservatively. An absent subscription means that an active subscription was not obtained, not proof that your cash balance is zero.

NanoGPT also offers [usage-only management tokens](https://docs.nano-gpt.com/api-reference/management-api). This extension does not need one because ST already handles the existing inference key on the server. It does not change billing or enable paid overage. If the subscription reports overage enabled, the panel notes it; actual billing also depends on the key's policy.

## Limitations / troubleshooting

This is a snapshot of the statistics NanoGPT returned; provider-side reporting can lag behind the latest answer. Click the refresh icon after waiting briefly. Auto-polling stops in hidden tabs. Server outages or expired credentials may require checking ST's API settings.

The ST credits route is required. Older ST versions and forks without that route cannot supply this widget's data. Server plugins are deliberately unnecessary. The widget doesn't fetch request logs, chat content or model prompts.

## Development

Plain JavaScript and CSS, no build step or external runtime dependencies.

```sh
npm test
```

Tests cover percentage units, exhausted/over-quota allowance, unavailable counters, optional daily limits and warning thresholds. No credentials are required for tests. Never commit keys, `secrets.json`, personal settings or account snapshots.

## Remove

Disable/uninstall **NanoGPT Quota** in Extensions and reload. There are no persistent settings or chat changes to clean up.

## License

MIT. Made for idcswap's SillyTavern setup.
