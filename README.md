# Unity Agent

An open source agent built on Pi to interact with Unity through the Unity CLI.

## Development

Install dependencies and start both the Svelte app and local Pi agent server:

```sh
pnpm install
pnpm dev
```

Open <http://localhost:5173>. The Vite development server proxies `/agent` to
the local WebSocket server on port `8787`.

The backend uses Pi's selected model and authentication from
`~/.pi/agent/settings.json` and `~/.pi/agent/auth.json`. Run `pi` and use
`/login` or configure a provider API key before sending prompts.

Browser WebSockets are restricted to the local Vite origin by default. Set a
comma-separated `UNITY_AGENT_ORIGINS` value when intentionally serving the UI
from another origin.

The first registered Unity tool is `unity_status`. It safely runs:

```sh
unity --non-interactive --no-banner --format json status
```

Its connected or disconnected result is shown in the Editor inspector after the
agent invokes the tool.

```sh
pnpm check
pnpm test
pnpm build
```
