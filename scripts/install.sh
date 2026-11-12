#!/usr/bin/env bash
# Pipra Universal Linux/macOS One-Liner Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/anggit-arisa/pipra/main/scripts/install.sh | bash

set -e

INSTALL_DIR="${HOME}/.pipra"
BIN_DIR="${HOME}/.local/bin"
REPO_ARCHIVE="https://github.com/anggit-arisa/pipra/archive/refs/heads/main.tar.gz"

echo "==> Installing Pipra..."

mkdir -p "$INSTALL_DIR" "$BIN_DIR"

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$REPO_ARCHIVE" | tar -xz -C "$INSTALL_DIR" --strip-components=1
elif command -v wget >/dev/null 2>&1; then
  wget -qO- "$REPO_ARCHIVE" | tar -xz -C "$INSTALL_DIR" --strip-components=1
else
  echo "Error: curl or wget is required to install Pipra." >&2
  exit 1
fi

cat << 'EOF' > "$BIN_DIR/pipra"
#!/usr/bin/env bash
exec node "$HOME/.pipra/bin/pipra.js" "$@"
EOF

chmod +x "$BIN_DIR/pipra"

echo ""
echo "==> Pipra installed successfully to $INSTALL_DIR"
echo "==> Executable created at $BIN_DIR/pipra"
echo ""
echo "To start Pipra:"
echo "  pipra start"
echo ""
echo "If '$BIN_DIR' is not in your PATH, add it by running:"
echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""

