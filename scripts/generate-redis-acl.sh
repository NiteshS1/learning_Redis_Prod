#!/usr/bin/env bash

set -euo pipefail

if [ ! -f ".env" ]; then
  echo ".env not found"
  exit 1
fi

set -a

# shellcheck disable=SC1091
source .env

set +a

required_vars=(
  REDIS_PASSWORD
  REDIS_ADMIN_PASSWORD
  REDIS_REPLICA_PASSWORD
  REDIS_SENTINEL_CONTROL_PASSWORD
)

for variable in "${required_vars[@]}"; do
  if [ -z "${!variable:-}" ]; then
    echo "Missing $variable"
    exit 1
  fi
done

sha256() {
  printf '%s' "$1" |
    sha256sum |
    awk '{ print $1 }'
}

APP_HASH="$(
  sha256 "$REDIS_PASSWORD"
)"

ADMIN_HASH="$(
  sha256 "$REDIS_ADMIN_PASSWORD"
)"

REPLICA_HASH="$(
  sha256 "$REDIS_REPLICA_PASSWORD"
)"

SENTINEL_HASH="$(
  sha256 "$REDIS_SENTINEL_CONTROL_PASSWORD"
)"

mkdir -p redis/runtime

cat > redis/runtime/users.acl <<EOF
user default off

user redis-admin on #${ADMIN_HASH} ~* &* +@all

user replica-user on #${REPLICA_HASH} +psync +replconf +ping

user sentinel-control on #${SENTINEL_HASH} resetkeys resetchannels &__sentinel__:hello +multi +slaveof +ping +exec +subscribe +config|rewrite +role +publish +info +client|setname +client|kill +script|kill

user todo-api on #${APP_HASH} resetkeys resetchannels \
~todo:* \
~todos:all \
~lock:todo:* \
~session:* \
~user:*:sessions \
~rate-limit:* \
+get \
+set \
+del \
+exists \
+expire \
+pexpire \
+ttl \
+pttl \
+incr \
+sadd \
+srem \
+smembers \
+scard \
+zadd \
+zcard \
+zrange \
+zremrangebyscore \
+multi \
+exec \
+discard \
+eval \
+ping \
+hello \
+client|setname \
+client|setinfo
EOF

chmod 600 \
  redis/runtime/users.acl

echo \
  "Generated redis/runtime/users.acl"