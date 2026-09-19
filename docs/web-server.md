# The web server

This is the live Gizmo — the one reachable at
<https://gizmo.genge.init0.link>, serving a built bundle rather than a dev
build. It is not started from this repo.

## What owns it

A Windows scheduled task named **Gizmo Web** runs
`C:\ProgramData\genge-services\bin\Supervise.ps1 -Name gizmo` at logon. That
supervisor reads `C:\ProgramData\genge-services\conf\gizmo.json` and runs

```
node .../tsx/dist/cli.mjs scripts/web-server.ts run
```

from the repo root, restarting it 15 seconds after any exit. So
`scripts/web-server.ts` is still the entry point — but only its `run` verb,
and the supervisor is the one that says it.

The config file also holds the environment the server needs, which is the part
that is easy to get wrong by hand:

| Variable | Value | Why |
| --- | --- | --- |
| `GIZMO_PORT` | `8787` | Agent server, bound to loopback only. |
| `GIZMO_WEB_PORT` | `4173` | Vite preview; the only listener on the tailnet. |
| `GIZMO_WEB_HOSTS` | `localhost,127.0.0.1,100.105.88.93,genge.angler-musical.ts.net,gizmo.genge.init0.link` | Vite's `allowedHosts`. |
| `GIZMO_WEB_ORIGINS` | `https://gizmo.genge.init0.link` | The agent server's origin allowlist. |
| `PATH` | mise shims first | Without this, `mise` is not on PATH and startup fails. |

## Restarting it

```
schtasks /End /TN "Gizmo Web" && schtasks /Run /TN "Gizmo Web"
```

Give it up to two minutes: the supervisor waits for both health ports (8787
and 4173) before reporting healthy, and the agent server's extensions take a
while to load. To check:

```
pnpm web:server:status
```

That probes the ports. It deliberately does not consult any state file — see
below.

## Do not start it by hand

There is no way to, and that is deliberate: `scripts/web-server.ts` has exactly
two verbs, `run` and `status`. Starting a second server by hand takes ports 8787
and 4173, and the supervisor then logs `port 8787 is held by pid(s) N which are
NOT ours` every 15 seconds and never comes back up. If that has happened,
`taskkill /PID <pid> /T /F` and wait for the next attempt.

## Checking it in a browser

Use `https://gizmo.genge.init0.link`, not `http://localhost:4173`. The page
loads on localhost, but `GIZMO_WEB_ORIGINS` allows only the tunnel origin, so
the client's WebSocket is rejected and the app sits there unconnected. That
failure looks like a broken app rather than a wrong URL.

## Not this server

`pnpm dev:server:start` is a different thing — a `tsx watch` dev build with
its own state in `.gizmo-dev/`, unsupervised and safe to start and stop. Those
verbs still work because for the dev server they still mean something.
