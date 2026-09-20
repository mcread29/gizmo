#!/bin/sh
# Fetches the latest Gizmo release, verifies it, and installs it under
# ~/.gizmo. It deliberately does not configure or start anything: a piped
# script should never register a service.
set -eu

repo=mcread29/gizmo
data_dir=${GIZMO_DATA_DIR:-$HOME/.gizmo}
bin_dir=${GIZMO_BIN_DIR:-$HOME/.local/bin}

die() { echo "gizmo: $1" >&2; exit 1; }

need() {
	command -v "$1" >/dev/null 2>&1 || die "$1 is required. $2"
}

major() { echo "$1" | sed 's/^v//' | cut -d. -f1; }

need curl "Install curl, then re-run."
need tar "Install tar, then re-run."
need git "Gizmo clones the extension registry at runtime. Install git, then re-run."
need node "Gizmo needs Node 24 or newer. See https://nodejs.org."
[ "$(major "$(node --version)")" -ge 24 ] ||
	die "Node $(node --version) is too old; Gizmo needs 24 or newer."
if ! command -v pnpm >/dev/null 2>&1; then
	die "pnpm 11 or newer is required. Run: corepack enable"
fi
[ "$(major "$(pnpm --version)")" -ge 11 ] ||
	die "pnpm $(pnpm --version) is too old; Gizmo needs 11 or newer. Run: corepack enable"

version=${1:-$(curl -fsSL "https://api.github.com/repos/$repo/releases/latest" |
	sed -n 's/.*"tag_name" *: *"\([^"]*\)".*/\1/p' | head -n 1)}
[ -n "$version" ] || die "Could not work out the latest release tag."

tarball="gizmo-$version.tar.gz"
base="https://github.com/$repo/releases/download/$version"
staging=$(mktemp -d)
trap 'rm -rf "$staging"' EXIT

echo "Downloading $tarball"
curl -fsSL -o "$staging/$tarball" "$base/$tarball"
curl -fsSL -o "$staging/SHA256SUMS" "$base/SHA256SUMS"

expected=$(grep " $tarball\$" "$staging/SHA256SUMS" | awk '{print $1}')
[ -n "$expected" ] || die "SHA256SUMS does not list $tarball."
if command -v sha256sum >/dev/null 2>&1; then
	actual=$(sha256sum "$staging/$tarball" | awk '{print $1}')
else
	actual=$(shasum -a 256 "$staging/$tarball" | awk '{print $1}')
fi
[ "$actual" = "$expected" ] || die "$tarball checksum mismatch ($actual != $expected)."

target="$data_dir/app/releases/$version"
echo "Unpacking into $target"
rm -rf "$target"
mkdir -p "$target"
tar -xzf "$staging/$tarball" -C "$target"

echo "Installing dependencies"
(cd "$target" && pnpm install --frozen-lockfile)

# The unpacked tree now has tsx, so the real CLI can take over from here.
node "$target/node_modules/tsx/dist/cli.mjs" "$target/scripts/gizmo.ts" install --here

mkdir -p "$bin_dir"
cat > "$bin_dir/gizmo" <<SHIM
#!/bin/sh
exec "$data_dir/app/current/bin/gizmo" "\$@"
SHIM
chmod +x "$bin_dir/gizmo"

echo
echo "Installed $version."
case ":$PATH:" in
	*":$bin_dir:"*) ;;
	*) echo "Add $bin_dir to your PATH to use \`gizmo\` directly." ;;
esac
echo "Next:"
echo "  gizmo configure --local"
echo "  gizmo service install && gizmo service start"
