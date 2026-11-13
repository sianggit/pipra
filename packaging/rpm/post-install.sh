#!/bin/sh
set -e

# 1. Establish FHS-compliant isolated directory hierarchy
mkdir -p /var/lib/pipra/data /var/log/pipra /etc/pipra
chown -R pipra:pipra /var/lib/pipra /var/log/pipra
chmod 700 /var/lib/pipra /var/lib/pipra/data
chmod 750 /var/log/pipra

# 2. ISO 27001 Cryptographic Hardening: Auto-generate production secrets if missing
ENV_FILE="/etc/pipra/pipra.env"
if [ ! -f "$ENV_FILE" ]; then
    RAND_SESSION=$(openssl rand -hex 32 2>/dev/null || od -vN 32 -An -tx1 /dev/urandom | tr -d ' \n')
    RAND_MASTER=$(openssl rand -hex 32 2>/dev/null || od -vN 32 -An -tx1 /dev/urandom | tr -d ' \n')
    cat <<EOF > "$ENV_FILE"
NODE_ENV=production
PORT=4200
PIPRA_DATA_DIR=/var/lib/pipra/data
SESSION_SECRET=${RAND_SESSION}
MASTER_KEY=${RAND_MASTER}

# External SIEM / Syslog Integration (ISO 27001 A.8.15)
SIEM_WEBHOOK_URL=
SIEM_SYSLOG_HOST=
SIEM_SYSLOG_PORT=514
EOF
    chown root:pipra "$ENV_FILE"
    chmod 640 "$ENV_FILE"
    echo "[Pipra RPM] Generated hardened production secrets in $ENV_FILE"
fi

# 3. Create symlink for global CLI if not exists
if [ ! -L /usr/bin/pipra ] && [ -f /usr/lib/pipra/bin/pipra.sh ]; then
    ln -sf /usr/lib/pipra/bin/pipra.sh /usr/bin/pipra
fi

# 3.1 Configure git safe.directory globally for unprivileged service execution
if command -v git >/dev/null 2>&1; then
    git config --system --add safe.directory '*' >/dev/null 2>&1 || true
fi

# 4. Systemd service lifecycle reload
if [ -d /run/systemd/system ]; then
    systemctl daemon-reload >/dev/null 2>&1 || true
    if systemctl is-active --quiet pipra; then
        echo "[Pipra RPM] Restarting active Pipra service following package upgrade..."
        systemctl restart pipra >/dev/null 2>&1 || true
    fi
fi

exit 0

