#!/bin/sh
set -e

# Create dedicated unprivileged system group if not exists
if ! getent group pipra >/dev/null 2>&1; then
    groupadd -r pipra
fi

# Create dedicated unprivileged system user if not exists
if ! getent passwd pipra >/dev/null 2>&1; then
    useradd -r -g pipra -d /var/lib/pipra -s /sbin/nologin \
        -c "Pipra Control Plane System User" pipra
fi

# Add pipra user to docker group if docker group exists
if getent group docker >/dev/null 2>&1; then
    usermod -aG docker pipra >/dev/null 2>&1 || true
fi

exit 0
