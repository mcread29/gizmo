# The web server

This is the always-on Gizmo — the one reachable at
<https://gizmo.genge.init0.link>, serving a built bundle rather than a dev
build. It is owned by the machine's supervisor, not by this repo, and not by
you.

## The one command

Everything is a `gizmo` verb. In a checkout that is `pnpm gizmo <verb>`; an
installed Gizmo puts `gizmo` on PATH.

| Command                                             | What it does                                  |
| --------------------------------------------------- | --------------------------------------------- |
| `gizmo status`                                      | Probes both ports and every configured URL.   |
| `gizmo configure --show`                            | Prints `~/.gizmo/web.json`.                   |
| `gizmo configure --local\|--tailscale\|--url <url>` | Rewrites it.                                  |
| `gizmo service restart`                             | Applies a configuration change.               |
| `gizmo service install\|uninstall`                  | Registers or removes the supervisor entry.    |
| `gizmo run`                                         | The process the supervisor runs. Not for you. |

## What it reads

`~/.gizmo/web.json` (or `$GIZMO_DATA_DIR/web.json`) is the whole
configuration:

```json
{
	"agentPort": 8787,
	"webPort": 4173,
	"bind": "all",
	"urls": [
		"http://localhost:4173",
		"http://127.0.0.1:4173",
		"http://genge.angler-musical.ts.net:4173",
		"http://100.105.88.93:4173",
		"https://gizmo.genge.init0.link"
	]
}
```

`urls` is the part that is easy to get wrong by hand, because one list feeds
two allowlists: their hostnames become Vite's `allowedHosts`, and their origins
become the agent server's WebSocket allowlist. A host missing from `urls` loads
the page and then never connects — which looks like a broken app rather than a
wrong URL.

`bind` is derived from `urls` rather than chosen: `loopback` when they are all
local, `tailscale` when they are all tailnet names, `all` when both kinds are
present — as here, because the Caddy front reaches Vite preview on `127.0.0.1`
while the tailnet names reach it directly. `gizmo configure --bind` overrides
the derivation if you ever need it to.

Until a machine has a `web.json`, the server falls back to the older
`GIZMO_PORT` / `GIZMO_WEB_PORT` / `GIZMO_WEB_HOSTS` / `GIZMO_WEB_ORIGINS`
environment variables. That fallback is what keeps a pre-`web.json` instance
running across this change.

## What owns it

On Linux a systemd user unit (`gizmo.service`), on macOS a launchd agent
(`link.init0.gizmo`), on Windows a scheduled task (**Gizmo Web**). All three
run `gizmo run` at login and restart it 15 seconds after any exit. Output is
appended to `~/.gizmo/logs/web.log`.

`gizmo service install` writes whichever of those applies to the platform, and
`gizmo status` prints the matching restart command when a probe fails.

On Windows, `gizmo service install` and `gizmo service uninstall` need an
elevated console. Windows lets an ordinary token query, run and end a task but
not create or delete one, and `schtasks` reports that as a bare
"Access is denied"; the CLI turns it into an instruction. Everything else —
`start`, `stop`, `restart`, `status` — works from a normal console.

The task runs as `S4U`, the no-window, no-stored-password logon type. An
`InteractiveToken` task puts its action on the desktop, so `startup.cmd` would
open a console window at every login and take the server down with it the first
time someone closed that window.

## Restarting it

```
gizmo service restart
```

Give it up to two minutes: it waits for both health ports before reporting
healthy, and the agent server's extensions take a while to load. `gizmo status`
answers the same question at any time.

## Do not start it by hand

Starting a second server takes ports 8787 and 4173, and the supervisor then
never comes back up — it logs that the port is held by a pid that is not its
own, every 15 seconds. If that has happened, kill the hand-started process and
wait for the next attempt.

## Checking it in a browser

Use a URL that is in `urls`. `https://gizmo.genge.init0.link` always is;
`http://localhost:4173` is only there if `gizmo configure --local` has been
run. On a URL outside the list the page loads but the client's WebSocket is
rejected, which looks like a broken app.

## Not this server

`pnpm dev:server:start` is a different thing — a `tsx watch` dev build with
its own state in `.gizmo-dev/`, unsupervised and safe to start and stop. Those
verbs still work because for the dev server they still mean something.
