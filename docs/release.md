# Releasing and installing Gizmo

This is the plan for turning Gizmo from "a checkout on one Windows box run by
a scheduled task" into something a user installs on Linux, macOS, or Windows
with one command, reaches over localhost, Tailscale, or their own domain, and
can remove cleanly. It covers the app and the extension registry, because the
two ship separately and have to agree on a contract.

This is implemented as of 2026-09-19, with two deviations from the original
plan, both marked **Deviation** where they apply below. What is not done is the
migration of this machine's live instance and the first tag — see "Migrating
the current live instance" at the end. [web-server.md](web-server.md) describes
the live instance as it stands today.

## What is fixed by how Gizmo is built

Three facts shape everything else:

1. **The server runs source.** `apps/agent-server` executes under `tsx`, and
   extensions are TypeScript that Pi loads through jiti. There is no compiled
   backend to ship, and there will not be one soon. A release is therefore a
   pinned source tree plus a prebuilt browser bundle, not a binary.
2. **Extensions need `git` and `pnpm` at runtime.** The registry is cloned and its
   server dependencies installed on the user's machine (`registry-storage.ts`, `registry-git-build.ts`).
   Those tools are prerequisites of the app, not of a build step.
3. **Only one listener is ever exposed.** The agent server binds loopback; Vite
   preview is the one port that leaves the machine, and it proxies `/agent`.
   Every host the page is served on must also be in the agent server's origin
   allowlist, or the socket is rejected and the app looks broken.

## Versioning and channels

- Gizmo uses semver tags `vMAJOR.MINOR.PATCH` on `main`. Today there are no
  tags; the first release is `v0.1.0`.
- Development happens on local scratch branches, which are never pushed and
  never become pull requests. A release squashes the scratch branch onto
  `main` as one commit (`git merge --squash`), so `main` is a history of
  releases and nothing else. See [AGENTS.md](../AGENTS.md).
- **Protocol version** (`packages/protocol`, currently v34) is the app's own
  compatibility number between server and browser. It stays internal.
- **Extension API version** is the major version of the published
  `@gizmo/extension-api` package, the contract between the app and every
  extension. It is the number both repos pin to, see "The registry" below
  and [extension-api.md](extension-api.md).
- Two channels:
  - `stable` installs the latest tag. This is the default.
  - `source` runs from a git checkout you own, with no tarball. This is what
    the current live instance already does and stays supported so the
    developer machine can run `main`.

### Release procedure

A GitHub Actions workflow (`.github/workflows/release.yml`) runs on every
`v*` tag:

1. `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm build`.
2. Pack `gizmo-vX.Y.Z.tar.gz`: the repository tree at the tag, plus
   `apps/app/dist`, minus `node_modules`, `research`, `screenshots`,
   `skills-ref`, and the `.gizmo-*` runtime directories. Include a
   `RELEASE.json` with `{ version, commit, extensionApiVersion,
registryRef }`.
3. Write `SHA256SUMS` and attach both to a GitHub Release. The tag body is the
   `WORKLOG.md` section for the release.

Cutting a release by hand is `git tag vX.Y.Z && git push --tags`. Nothing else
is manual.

## On-disk layout

Everything Gizmo installs lives in one place, so uninstall is one directory
plus one service entry. `GIZMO_DATA_DIR` still relocates the whole thing.

```
~/.gizmo/
  app/
    releases/v0.1.0/      unpacked release, node_modules installed
    releases/v0.1.1/
    current -> releases/v0.1.1   (junction on Windows)
  web.json                instance configuration, see below
  logs/web.log            supervisor + server output
  sessions/               (existing) threads
  registries/             (existing) registry clone and installed.json
  extensions/             links Gizmo made, recorded in installed.json
  extensions-disabled/    globally disabled extensions
  ...                     (existing) auth, settings, memory
```

`~/.pi/agent` is Pi's, shared with the Pi CLI. Gizmo keeps nothing there;
hand-written extensions live in `~/.gizmo/extensions`, where both Gizmo and
the Pi CLI are out of each other's way.

A `source` install has no `releases/`; `current` points at the checkout.

## The `gizmo` command

One entry point, `scripts/gizmo.ts`, exposed as `pnpm gizmo` from a checkout
and as `~/.gizmo/app/current/bin/gizmo` (a shim the installer puts on PATH)
from a release. It replaces `web-server.ts`, `web-update.ts`, `reload`, and
`reload.cmd`. The verbs:

| Verb                                            | What it does                                                                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `gizmo install [vX.Y.Z]`                        | Fetch and unpack a release into `releases/`, `pnpm install --frozen-lockfile`, point `current` at it. Does not touch the service. |
| `gizmo configure ...`                           | Write `web.json`. Flags below.                                                                                                    |
| `gizmo service install`                         | Register the platform service pointing at `current`, enabled at login.                                                            |
| `gizmo service start / stop / restart / status` | Drive the platform service. `status` probes the two ports, as today.                                                              |
| `gizmo service uninstall`                       | Stop and unregister the service. Leaves files.                                                                                    |
| `gizmo run`                                     | The service's entry point: what `web-server.ts run` is today, reading `web.json` instead of raw env.                              |
| `gizmo update [vX.Y.Z]`                         | `install` the new version, then `service restart`. The old release stays for rollback; two are kept.                              |
| `gizmo rollback`                                | Point `current` at the previous release and restart.                                                                              |
| `gizmo uninstall [--purge]`                     | See "Uninstall".                                                                                                                  |

### The one-line installer

`scripts/install.sh` and `scripts/install.ps1` live in the repo and are
fetched raw from `main`:

```sh
curl -fsSL https://raw.githubusercontent.com/mcread29/gizmo/main/scripts/install.sh | sh
```

```powershell
irm https://raw.githubusercontent.com/mcread29/gizmo/main/scripts/install.ps1 | iex
```

Each does only four things: check prerequisites, download the latest release
tarball and verify its checksum, run `gizmo install` from inside it, and print
the next command. It does not configure or start anything, so a piped script
never registers a service. Prerequisites checked, with the fix printed if
missing:

| Tool      | Minimum  | Why                                                                  |
| --------- | -------- | -------------------------------------------------------------------- |
| Node      | 24       | `--experimental-strip-types` in the extension builder; `tsx`.        |
| pnpm      | 11       | `corepack enable` installs the pinned version from `packageManager`. |
| git       | any      | Registry clone and update.                                           |
| Tailscale | optional | Only for the `--tailscale` profile.                                  |

`mise` is not required. The current live instance needs it on PATH only
because that machine installs Node through it; the service definition
captures the resolved `node` path at install time instead.

## Reachability profiles

`web.json` replaces the environment table in `web-server.md`. A profile is
just a way of filling it in; users can combine them, which is what the
current live instance does.

```json
{
	"agentPort": 8787,
	"webPort": 4173,
	"bind": "loopback",
	"urls": ["http://localhost:4173", "https://gizmo.genge.init0.link"]
}
```

`gizmo run` derives everything the two processes need from this:

- `GIZMO_WEB_HOSTS` is the hostname of every entry in `urls`.
- `GIZMO_ORIGINS` is every entry in `urls` verbatim.
- `bind` decides which interface Vite preview listens on. The agent server is
  always loopback.

**Deviation.** `bind` has three values, not two: `loopback`, `tailscale`, and
`all`. The plan assumed each profile picks one, but Vite preview takes a single
`--host`, and a configuration that mixes a loopback URL (a TLS front reaching
`127.0.0.1`) with a raw tailnet URL needs both interfaces at once — which is
exactly what this machine does. So `bind` is derived rather than set per
profile: `bindFor()` returns the narrowest bind that still serves every URL in
`urls`, and `all` (0.0.0.0, today's live behaviour) is the answer when the URLs
disagree. `gizmo configure --bind <value>` overrides the derivation.

The profiles:

**`gizmo configure --local`** (default). Adds `http://localhost:<webPort>` and
`http://127.0.0.1:<webPort>`. `bind: loopback`.

**`gizmo configure --tailscale`**. Runs `tailscale status --json`, reads this
node's MagicDNS name and Tailscale IPs, and adds
`http://<magicdns>:<webPort>` and `http://<ip>:<webPort>`. Sets
`bind: tailscale`, meaning Vite preview binds the Tailscale IPv4 address only,
so the LAN never sees the port. With `--serve`, it additionally runs
`tailscale serve --bg <webPort>` and adds `https://<magicdns>` as a URL,
which gives a real certificate and keeps `bind: loopback`. `--serve` is
recommended when available.

**`gizmo configure --url https://gizmo.genge.init0.link`**. A custom domain
is a DNS record at Cloudflare (or any DNS host) that points at this node's
Tailscale IP. The record is DNS-only, not proxied: Cloudflare cannot reach a
`100.x` address, so the browser connects straight to the tailnet IP and only
tailnet members can get there. What the domain adds over MagicDNS is a name
you own and a certificate you control.

Because the machine is not reachable from the public internet, the
certificate has to come from a DNS-01 challenge, which needs an API token for
the DNS zone. Gizmo does not obtain certificates or bind port 443 itself:
both need privileges a user-level service should not have, and they differ
on every platform. A small TLS front on the same box does that instead, and
Caddy is the recommended one because it is a single binary on all three
platforms, renews on its own, and gets the Cloudflare DNS module with
`caddy add-package github.com/caddy-dns/cloudflare`.

`gizmo configure --url` therefore does three things:

1. Adds the URL to `urls`, so its hostname is an allowed host and the URL an
   allowed origin. `bind` stays `loopback`; Caddy reaches Vite preview on
   `127.0.0.1:<webPort>`.
2. Prints a Caddyfile for the domain, bound to the Tailscale IP so the
   listener is not on the LAN, proxying to the web port, with the
   `tls { dns cloudflare {env.CLOUDFLARE_API_TOKEN} }` block. `--caddyfile
<path>` writes it instead of printing it.
3. Reminds that the DNS record must be an unproxied `A` record for the
   Tailscale IPv4 address (and optionally `AAAA` for the IPv6 one), and that
   `gizmo configure --tailscale` should be run too so the raw IP and MagicDNS
   name also work if the domain is ever unreachable.

`gizmo service status` fetches every configured URL and reports each one, so
a lapsed certificate or a missing DNS record shows as "unreachable" against
the URL rather than as a page that loads and never connects.

If a different front is preferred (nginx, Traefik, a cert from `lego` with
Vite preview serving HTTPS directly), only step 1 matters; the URL list is
the whole contract between Gizmo and whatever sits in front of it.

Flags accumulate. `gizmo configure --show` prints the file; `--reset` empties
it. Any change to `web.json` needs `gizmo service restart`, and the CLI says so.

### Who can reach it

Neither Vite preview nor the agent server authenticates anyone; in all three
profiles the network is the identity. Localhost is the machine's user,
and both the Tailscale profile and a custom domain that resolves to a
Tailscale IP are reachable only by tailnet members, which Tailscale ACLs
can narrow further. The one thing not to do is point a _proxied_ Cloudflare
record or a public tunnel at the web port, because that exposes an
unauthenticated Gizmo to the internet. `gizmo configure --url` checks the
DNS answer and refuses an address that is not in `100.64.0.0/10` or the
node's Tailscale IPv6 range unless `--public` is passed, and `--public` prints
that warning.

## Platform services

The service is always "run `node <current>/... gizmo.ts run`, restart if it
exits, start at login". Each platform's native supervisor does that already,
so the repo's `Supervise.ps1` loop goes away.

| Platform | Mechanism                                                                                                                                                                                   | File                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Linux    | systemd user unit, `Restart=always`, `RestartSec=15`, `loginctl enable-linger` so it runs without a session                                                                                 | `~/.config/systemd/user/gizmo.service`          |
| macOS    | launchd LaunchAgent, `KeepAlive: true`, `ThrottleInterval: 15`                                                                                                                              | `~/Library/LaunchAgents/link.init0.gizmo.plist` |
| Windows  | Scheduled task **Gizmo Web**, at logon, least privilege, plus a `startup.cmd` that sets `GIZMO_DATA_DIR` if configured and loops: straight back up after exit code 75, after 15 s otherwise | `<dataDir>/app/startup.cmd`                     |

**Deviation.** The Windows launcher lives at `<dataDir>/app/startup.cmd`, not
`%LOCALAPPDATA%\gizmo\startup.cmd`. Putting it under `%LOCALAPPDATA%` would
have been a second Gizmo-owned location outside the data directory, which
contradicts "everything Gizmo installs lives in one place" and would survive
`gizmo uninstall --purge` on a machine with a relocated `GIZMO_DATA_DIR`.

`scripts/lib/supervised.ts` is gone; `gizmo status` prints the restart command
for the platform in use instead of the hard-coded `schtasks` line
(`restartCommand()` in `scripts/gizmo/service-platform.ts`).

Health checks stay as they are: the supervisor is not consulted for status,
the ports are. `gizmo run` still waits for the agent port before starting Vite
preview, so a page never loads against a socket that is not up yet.

## The registry

The registry ships independently of the app, so the two need a shared pin.
That pin is the major version of `@gizmo/extension-api`, the published
package every extension is written against; see
[extension-api.md](extension-api.md).

- `gizmo-registry` gets a release branch per API major: `v1`, later `v2`.
  `main` is where breaking work happens. Tagged commits on `v1` are the
  registry's releases.
- The app stops cloning `HEAD` of the default branch. `registry-storage.ts`
  gains a `registryRef` next to `registryUrl`, set from the API major the app
  ships, and the clone and every `git pull` use that branch. An app on API 1
  can never pull an extension written against API 2.
- `gizmo.registry.json` declares `gizmoApiVersion`. The app refuses a
  registry whose number does not match, with the previous clone intact.
- With no browser bundles there is no registry build. Install is a clone plus
  `pnpm install --frozen-lockfile` for server-side dependencies, which is why
  `git` and `pnpm` stay prerequisites.
- **Update** stays `registry.update` in Settings, unchanged. It is a
  fast-forward pull on the release branch, dependency install, re-link,
  reload.
- **Uninstall of everything from the registry** is a new `registry.reset`
  request: unlink every id in `installed.json` (both enabled and disabled
  locations), remove the clone, and write an empty state. `gizmo uninstall
--purge` calls the same code path directly so it works with the server
  stopped. Hand-written global and project-local extensions are the user's
  own files and are never touched.

Registry contributors do not need a Gizmo release to publish an extension;
they merge to `v1` and users see it on the next `registry.update`. A Gizmo
release is needed only when the API major changes.

## Update and rollback

```sh
gizmo update            # latest stable
gizmo update v0.2.0     # a specific tag
gizmo rollback          # previous release
```

`update` installs beside the running version and only restarts once
`pnpm install` has succeeded, so a failed download or install leaves the
current instance serving. For a `source` install, `update` is `git pull`,
`pnpm install`, `pnpm build`, restart, which is what `pnpm web:update` does
now.

### From the browser

Settings → About shows the running version, checks GitHub for the latest
tag (or the branch tip for a `source` install) and offers **Update to
vX.Y.Z** when there is one. The button runs the same CLI from inside the
server: `gizmo update --no-restart` downloads, verifies, unpacks and installs
the release, then moves `current`. The server cannot restart its own service
from inside that service (the stop would end the CLI along with it), so once
the CLI succeeds the server exits with code 75 and the supervisor's
restart-on-exit brings up `current`, which is now the new release. On Windows that is
`startup.cmd`'s loop: Task Scheduler's own restart-on-failure only retries a
task that could not be launched, not one whose action exited. Every open
tab sees the progress as `app.update.changed` events, drops when the server
exits, and reconnects on its own. A failure at any step leaves the running
release serving and shows the last lines of CLI output on the page.

A restart takes up to two minutes on a machine with many extensions, as
today; `update` waits on the ports and reports.

## Uninstall

```sh
gizmo uninstall          # stop and unregister the service, remove ~/.gizmo/app
gizmo uninstall --purge  # also remove ~/.gizmo entirely
```

Without `--purge`, sessions, settings, memory, and linked extensions survive,
and reinstalling picks them up. The CLI lists what `--purge` will delete and
asks for a `y` unless `--yes` is passed. It never touches `~/.pi/agent`:
that directory belongs to the Pi CLI, and Gizmo keeps nothing in it.

If the `gizmo` shim is gone, the same steps by hand are:

1. Stop and remove the service: `systemctl --user disable --now gizmo`,
   `launchctl bootout gui/$UID ~/Library/LaunchAgents/link.init0.gizmo.plist`,
   or `schtasks /Delete /TN "Gizmo Web" /F`.
2. Remove `tailscale serve` if it was enabled: `tailscale serve --bg off`.
3. Delete `~/.gizmo`. Hand-written global and project-local extensions are the user's
   own files and stay where they are; anything left under `~/.pi/agent` belongs
   to the Pi CLI.

## Migrating the current live instance

The Windows box runs from a checkout via `Supervise.ps1` and a config under
`C:\ProgramData\genge-services`. The migration is:

1. `pnpm gizmo configure --local --tailscale --url https://gizmo.genge.init0.link`
   from the checkout. This reproduces the five hosts and one origin in the
   table in `web-server.md`. TLS for the domain is terminated by the
   machine's `tailnet-domains` service, which keeps proxying to
   `127.0.0.1:4173`; skip the Caddyfile that `--url` prints. That service is
   specific to this machine and is not part of what other users install.
2. `schtasks /End /TN "Gizmo Web"`, then `pnpm gizmo service install` from the
   checkout, which rewrites the same task name to point at `gizmo run` there.
   There is no `--source` flag: the service is registered against the tree
   the CLI itself is running from (a checkout as itself, a release install as
   `app/current`), so running it out of the checkout is what makes it a
   source install.
3. `pnpm gizmo service start`, then `pnpm gizmo service status`.
4. Delete `gizmo.json` from the `genge-services` conf directory. The other
   services there are untouched.

## Implementation order

1. `web.json` and `gizmo run` reading it, with `web-server.ts` reduced to a
   shim that forwards to it. This is the only change that touches the live
   instance's behaviour, and it can be verified in place.
2. Service install and uninstall for the three platforms, and the migration
   above.
3. `configure` with the three profiles, including `tailscale status --json`
   discovery, `tailscale serve`, the Caddyfile for a custom domain, and the
   tailnet-address check on its DNS answer.
4. Registry release branch, `registryRef`, `gizmoApiVersion` check, and
   `registry.reset`.
5. Release workflow, tarball, `install`/`update`/`rollback`, the two
   one-line installers, and the first tag.

Each step leaves the repo working and the live instance running.
