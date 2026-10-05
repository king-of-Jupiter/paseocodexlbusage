# paseocodexlbusage

A [Paseo](https://paseo.sh) usage-source plugin that surfaces credit limits from a
[codex-lb](https://github.com/Soju06/codex-lb) load balancer in Paseo's **Usage** page.

Usage data is pulled from your own codex-lb instance: the plugin polls the balancer's usage
endpoint (the `limits[]` payload with `5h` / `7d` credit windows) over HTTPS with a Bearer token
and renders the two windows as native Paseo usage bars. Nothing else from the endpoint response
is displayed — no costs, token counters, or pool stats.

## Requirements

- Paseo daemon **>= 0.11.0** (usage sources are a 0.11 daemon API).
- A running [codex-lb](https://github.com/Soju06/codex-lb) instance with its usage endpoint
  reachable from the daemon host, plus a Bearer token for it.

## Install

On the daemon host:

```bash
paseo plugin add king-of-Jupiter/paseocodexlbusage
```

Or paste `king-of-Jupiter/paseocodexlbusage` into **Settings → Plugins → Plugin source**
and select **Install plugin**. Then update later with:

```bash
paseo plugin update paseocodexlbusage
```

## Configure

1. Open **Settings → Plugins → CodexLB** (or run the *Configure CodexLB* command via ⌘K / Ctrl+K).
2. Set **Endpoint URL** to your balancer's usage endpoint, e.g. `https://example.com/api/usage`.
3. Set **Bearer token** (sent as `Authorization: Bearer …`).
4. Save, then open the **Usage** page and hit **Refresh**.

Leaving both fields empty disables the source. Credentials live only in host settings —
they are never part of usage inputs or reports.

## How the data is mapped

Each `limits[]` entry becomes one Paseo usage window:

| `limit_window` | Paseo window | Label |
| -------------- | ------------ | ----- |
| `5h`           | `five_hour`  | 5-hour (short: `5h`) |
| `7d`           | `weekly`     | Weekly (short: `wk`) |

- `usedPct = current_value / max_value`, reset time taken from `reset_at`.
- Non-duration `limit_window` values fall back to a window named after the provider string.
- A `model_filter`, when present, scopes the window ID.

Note on percentages: like the built-in Claude/Codex sources, Paseo bars show the **consumed**
share (`current_value`), while the codex-lb dashboard shows the **remaining** share — the two
always add up to 100%.

## Development

```bash
npm install
npm run typecheck
```

## Credits

- Usage data: [Soju06/codex-lb](https://github.com/Soju06/codex-lb) — Codex/ChatGPT multi-account
  load balancer & proxy with usage tracking.
- Built against the [Paseo plugin reference](https://paseo.sh/docs/plugins/reference#usage-sources).
