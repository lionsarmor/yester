#!/bin/bash
set -euo pipefail
cd /opt/roddy-id/app
getent passwd roddy-id >/dev/null || useradd --system --home /var/lib/roddy-id --shell /usr/sbin/nologin roddy-id
install -d -m 700 -o roddy-id -g roddy-id /var/lib/roddy-id
install -d -m 750 -o root -g roddy-id /etc/roddy-id
if [ ! -x ../venv/bin/python ]; then python3 -m venv ../venv; fi
../venv/bin/pip --disable-pip-version-check -q install -r requirements.txt
runuser -u roddy-id -- sh -ec 'umask 077; cd /var/lib/roddy-id; test -s django.key || openssl rand -hex 48 > django.key; test -s signing.pem || openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out signing.pem 2>/dev/null'
runuser -u roddy-id -- env DJANGO_SETTINGS_MODULE=settings ../venv/bin/python -m django migrate --noinput
runuser -u roddy-id -- env DJANGO_SETTINGS_MODULE=settings ../venv/bin/python -m django shell < deploy/register-clients.py
if [ -f /root/roddy-id-founder.hash ]; then
    runuser -u roddy-id -- env RODDY_FOUNDER_EMAIL="${RODDY_FOUNDER_EMAIL:?Set founder email}" ../venv/bin/python deploy/founder.py < /root/roddy-id-founder.hash
fi
install -m 644 deploy/roddy-id.service /etc/systemd/system/roddy-id.service
systemctl daemon-reload
systemctl enable --now roddy-id
systemctl restart roddy-id
for i in {1..20}; do
    if curl -fsS -H 'Host: accounts.roddy.world' -H 'X-Forwarded-Proto: https' http://127.0.0.1:8142/.well-known/openid-configuration >/dev/null; then break; fi
    sleep 1
done
curl -fsS -H 'Host: accounts.roddy.world' -H 'X-Forwarded-Proto: https' http://127.0.0.1:8142/login/ >/dev/null
install -m 644 deploy/accounts.caddy /etc/caddy/roddy-id.caddy
candidate=$(mktemp /etc/caddy/roddy-id-stage.XXXXXX)
cp -p /etc/caddy/Caddyfile "$candidate"
if ! grep -Fxq 'import /etc/caddy/roddy-id.caddy' "$candidate"; then printf '\nimport /etc/caddy/roddy-id.caddy\n' >> "$candidate"; fi
caddy validate --config "$candidate" --adapter caddyfile >/dev/null
backup=$(mktemp /etc/caddy/Caddyfile.before-roddy-id.XXXXXX)
cp -p /etc/caddy/Caddyfile "$backup"
mv "$candidate" /etc/caddy/Caddyfile
if ! systemctl reload caddy; then cp -p "$backup" /etc/caddy/Caddyfile; systemctl reload caddy; exit 1; fi
echo "RODDY ID installed"
