#!/bin/sh
set -e

# $1 == 0 indicates complete package uninstallation (not an upgrade)
if [ "$1" = "0" ] || [ "$1" = "uninstall" ]; then
    if [ -d /run/systemd/system ]; then
        systemctl stop pipra >/dev/null 2>&1 || true
        systemctl disable pipra >/dev/null 2>&1 || true
    fi
    rm -f /usr/bin/pipra >/dev/null 2>&1 || true
fi

exit 0

