# Learn Redis

### A todo API that teaches Redis the way production systems use it

PostgreSQL stays the source of truth. Redis sits in front of it for cache, sessions, locks, and rate limits, on a primary with two replicas and three Sentinels. When Redis is slow or down, reads keep working and the API reports a degraded mode.

[TypeScript](https://www.typescriptlang.org/) · [Node.js](https://nodejs.org/) · [Express](https://expressjs.com/) · [Redis](https://redis.io/) · [PostgreSQL](https://www.postgresql.org/) · [Prisma](https://www.prisma.io/) · [Docker Compose](https://docs.docker.com/compose/)


---

## Architecture

The API is a small Express service. Todos live in PostgreSQL. Redis holds the copies and coordination state that would otherwise be rebuilt on every request: cached rows, session records, distributed locks, and rate-limit counters.

```mermaid
flowchart LR
  Client[Client] --> API[Express API]
  API --> PG[(PostgreSQL)]
  API --> Primary[(Redis primary)]
  Primary --> R1[(Replica 1)]
  Primary --> R2[(Replica 2)]
  S1[Sentinel 1] --> Primary
  S2[Sentinel 2] --> Primary
  S3[Sentinel 3] --> Primary
  S1 --> R1
  S2 --> R2
  S3 --> Primary
```

A request follows one path:

1. The client calls the API. Protected routes read the `sessionId` cookie and load the session from Redis.
2. Rate limiting runs in Redis before the handler. Login uses a sliding window and fails closed. Todo reads and writes use a fixed window and fail open if Redis is unavailable.
3. Todo reads use cache-aside. A hit returns JSON from Redis. A miss loads PostgreSQL, then stores the result with a jittered TTL.
4. Writes go to PostgreSQL first, then delete the affected cache keys so the next read rebuilds them.
5. Readiness reports PostgreSQL and Redis separately. If Redis is down and PostgreSQL is up, the process stays ready in degraded mode.

Redis itself runs as one primary, two read-only replicas, and three Sentinels watching the primary under the name `todo-primary`. Persistence is RDB plus AOF. Memory is capped at 64 MB with `allkeys-lfu`.

## Why these patterns are easy to get wrong

##### TL;DR

_Caching, sessions, and rate limits look like a few Redis commands. The hard part is what happens on a miss stampede, a crash, a full memory limit, or a failover._

- **Stale reads.** A cache that is filled and never invalidated serves yesterday's todo after an update. TTL alone is a safety net, and explicit deletes on write are what keep the list and the single item in step with PostgreSQL.
- **Stampedes and penetration.** One popular key expiring sends every caller to the database at once. A missing id that is never cached does the same thing on every request. Locks and a short negative cache exist for those two cases.
- **Avalanche.** Keys that expire together fall over together. Jitter on the TTL spreads that expiry out.
- **Redis as a hard dependency.** Sessions cannot be served without the session store. Cached todo reads can. Treating both the same way either drops traffic you could have served, or lets unlimited logins through while the limiter is down.
- **Durability and failover.** A cache can be rebuilt. A session store and a rate-limit window cannot, at least not from PostgreSQL. RDB, AOF, replicas, and Sentinel are how this lab makes that difference visible.

## How this lab approaches it

Each pattern is wired into the todo API so you can watch it in the logs, break it, and see the fallback.

- **Cache-aside with an explicit contract.** `todo:{id}` and `todos:all` are filled on read and deleted on create, update, and delete. Values are JSON. TTLs carry jitter so expirations do not line up.
- **Negative caching and single-flight locks.** A missing todo is stored as `__NOT_FOUND__` for a short TTL. Rebuilding a single todo takes a `SET key token NX PX` lock so one caller hits PostgreSQL.
- **Fail the way the data deserves.** Cache gets return `null` when Redis is down, and the service reads PostgreSQL. Session create and lookup throw if the store is unavailable. Login rate limiting fails closed. Todo rate limiting fails open.
- **Sessions with two clocks.** A session lives at most 24 hours (absolute) and goes idle after 30 minutes (sliding). The session id in the cookie is random. Redis stores only its SHA-256 hash, and the user's session ids sit in a set so logout-all can revoke every device.
- **Atomic counters.** Fixed-window limits use `INCR` plus `EXPIRE` inside a Lua script. Sliding-window login limits use a sorted set, also in Lua, so the check and the write are one round trip.
- **A real topology.** Docker Compose starts PostgreSQL 18, Redis 8 primary, two replicas, and three Sentinels. ACL users are generated from `.env` so the app, the replicas, Sentinel, and an admin each get a different command set.

## Features

- **Todo cache.** Single-item and list caches, TTL with jitter, delete-on-write invalidation, and a debug route that skips the cache.
- **Cache protection.** Negative caching for unknown ids, `SET NX` locks around the database fill, and logging for hits, misses, lock contention, and memory pressure.
- **Sessions.** HttpOnly cookie, idle and absolute expiry, hashed session keys, `MULTI`/`EXEC` when creating a session, logout, and logout-all.
- **Rate limiting.** 5 login attempts per minute per IP (sliding window, fail closed). 100 todo reads and 20 todo writes per minute per session (fixed window, fail open). Responses include `RateLimit-*` and `Retry-After`.
- **Degraded operation.** `/health/ready` stays 200 when PostgreSQL is up and Redis is down, with `mode: "degraded"`.
- **Persistence and memory policy.** RDB snapshots (`save 60 1`) and AOF (`appendfsync everysec`) on the primary and both replicas. `maxmemory 64mb` and `allkeys-lfu`.
- **Replication and Sentinel.** Two replicas of `redis-primary:6379`. Three Sentinels, quorum 2, `down-after-milliseconds` 5000, failover timeout 15000. The API can connect standalone or through Sentinel.
- **Least-privilege ACL.** `todo-api` can touch only todo, session, lock, and rate-limit keys. `replica-user` can replicate. `sentinel-control` can fail over. `redis-admin` is the operator account. `default` is off.

## Prerequisites

1. [Node.js](https://nodejs.org/) 22 or newer
2. [Docker](https://www.docker.com/) and Docker Compose
3. A Unix shell for `scripts/generate-redis-acl.sh` (`sha256sum` is required)

## Quick setup

```bash
cp .env.example .env
```

Fill `.env` before generating the ACL file. Values that match this Compose file:

```bash
NODE_ENV=development
PORT=3000

POSTGRES_USER=todo_user
POSTGRES_PASSWORD=todo_password
POSTGRES_DB=todo_db
DATABASE_URL=postgresql://todo_user:todo_password@localhost:5432/todo_db

# App user. The ACL file names this account todo-api.
REDIS_PASSWORD=choose-an-app-password
REDIS_URL=redis://todo-api:choose-an-app-password@127.0.0.1:6379

REDIS_ADMIN_PASSWORD=choose-an-admin-password
REDIS_REPLICA_PASSWORD=choose-a-replica-password
REDIS_SENTINEL_CONTROL_PASSWORD=choose-a-sentinel-password

REDIS_MODE=sentinel
REDIS_SENTINEL_NAME=todo-primary
REDIS_SENTINEL_1_HOST=127.0.0.1
REDIS_SENTINEL_1_PORT=26379
REDIS_SENTINEL_2_HOST=127.0.0.1
REDIS_SENTINEL_2_PORT=26380
REDIS_SENTINEL_3_HOST=127.0.0.1
REDIS_SENTINEL_3_PORT=26381
REDIS_CLIENT_NAME=todo-api

DEMO_USER_EMAIL=demo@example.com
DEMO_USER_PASSWORD=choose-a-demo-password
DEMO_USER_ID=11111111-1111-1111-1111-111111111111
```

`REDIS_PASSWORD`, `REDIS_ADMIN_PASSWORD`, `REDIS_REPLICA_PASSWORD`, and `REDIS_SENTINEL_CONTROL_PASSWORD` are required. The generator writes SHA-256 hashes into `redis/runtime/users.acl` and never stores the raw passwords in that file.

```bash
bash scripts/generate-redis-acl.sh

docker compose up -d

npm install
npx prisma generate
npx prisma migrate deploy

npm run dev
```

That will:

1. Build the Redis ACL from `.env`
2. Start PostgreSQL, the Redis primary, two replicas, and three Sentinels
3. Generate the Prisma client and apply the todo migration
4. Start the API with hot reload

Once it is up:

| Service | Address |
| --- | --- |
| API | http://localhost:3000 |
| PostgreSQL | `localhost:5432` |
| Redis primary | `127.0.0.1:6379` |
| Redis replica 1 | `127.0.0.1:6380` |
| Redis replica 2 | `127.0.0.1:6381` |
| Sentinel 1 | `127.0.0.1:26379` |
| Sentinel 2 | `127.0.0.1:26380` |
| Sentinel 3 | `127.0.0.1:26381` |

Redis ports are bound to loopback only.

### Useful commands

```bash
# Follow the API
npm run dev

# Production-style run
npm run build && npm start

# Stop the data services
docker compose down

# Stop and delete database volumes
docker compose down -v

# Ping Redis as the admin user from .env
docker compose exec redis-primary \
  redis-cli --user redis-admin -a "$REDIS_ADMIN_PASSWORD" PING

# Who is primary, and are the replicas online?
docker compose exec sentinel-1 \
  redis-cli -p 26379 SENTINEL masters
```

Set `REDIS_MODE=standalone` and use `REDIS_URL` when you want the API to talk to the primary directly. `REDIS_MODE=sentinel` discovers the current primary through the three Sentinel ports. The monitored name is `todo-primary`.

### Call the API

Login checks `DEMO_USER_EMAIL` and `DEMO_USER_PASSWORD` from `.env` and sets an HttpOnly `sessionId` cookie.

```bash
curl -c cookies.txt -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"choose-a-demo-password"}'

curl -b cookies.txt -X POST http://localhost:3000/api/v1/todos \
  -H 'Content-Type: application/json' \
  -d '{"title":"Learn Sentinel","description":"Watch a failover"}'

curl -b cookies.txt http://localhost:3000/api/v1/todos
```

| Method | Path | Auth | What it does |
| --- | --- | --- | --- |
| `GET` | `/health` | No | Process is up |
| `GET` | `/health/live` | No | Liveness |
| `GET` | `/health/ready` | No | PostgreSQL required. Redis down means `degraded` |
| `POST` | `/api/v1/auth/login` | No | Creates a session cookie |
| `GET` | `/api/v1/auth/me` | Yes | Current session |
| `POST` | `/api/v1/auth/logout` | Yes | Revokes this session |
| `POST` | `/api/v1/auth/logout-all` | Yes | Revokes every session for the user |
| `GET` | `/api/v1/todos` | Yes | Cached list |
| `GET` | `/api/v1/todos/:id` | Yes | Cached item, with lock and negative cache |
| `POST` | `/api/v1/todos` | Yes | Insert, then drop `todos:all` |
| `PUT` | `/api/v1/todos/:id` | Yes | Update, then drop the item and the list |
| `DELETE` | `/api/v1/todos/:id` | Yes | Delete, then drop the item and the list |
| `GET` | `/api/v1/todos/debug/db/:id` | Yes | Same read, skipping Redis |
| `GET` | `/api/v1/todos/debug/slow` | Yes | Intentionally slow database read |

Todo writes accept `title` (1–200 characters), optional `description` (up to 2000), and on update a `completed` boolean. `:id` is a UUID.

### Redis keys

| Key | Structure | Used for |
| --- | --- | --- |
| `todo:{id}` | String (JSON) | One todo, or `__NOT_FOUND__` |
| `todos:all` | String (JSON) | Full list |
| `lock:todo:{id}` | String | Stampede lock, value is a random token |
| `session:{sha256}` | String (JSON) | Session payload. The cookie holds the raw id |
| `user:{userId}:sessions` | Set | Session hashes for logout-all |
| `rate-limit:{scope}:{id}:{window}` | String counter | Fixed window |
| `rate-limit:sliding:{scope}:{id}` | Sorted set | Sliding window |

### Lab scripts

```bash
# Replication, memory, persistence, and client summary
npx tsx scripts/redis-health.ts

# INFO memory, stats, and persistence sections
npx tsx scripts/redis-stats.ts

# Fill the instance until eviction or maxmemory shows up
KEY_COUNT=10000 VALUE_SIZE=10000 npx tsx scripts/fill-redis.ts

# Write a burst of keys, then stop Redis and inspect the AOF
npx tsx scripts/aof-crash-lab.ts
```

`benchmark.md` records an autocannon run against `GET /api/v1/todos` (20 seconds, 100 connections).

## Project layout

```text
src/
  app.ts                     routes and health checks
  server.ts                  connect, listen, graceful shutdown
  database/                  Prisma (pool max 10) and Redis client
  services/
    cache.service.ts         get / set / delete, miss and memory logs
    todo.service.ts          cache-aside, locks, invalidation
    session.service.ts       absolute + idle TTL, MULTI/EXEC
    lock.service.ts          SET NX PX and compare-and-delete
    rate-limit.service.ts    Lua fixed and sliding windows
  config/                    key names, TTLs, rate-limit numbers
redis/
  primary.conf               RDB, AOF, 64mb, allkeys-lfu, ACL
  replica-1.conf             replica of the primary
  replica-2.conf
  sentinel/                  three Sentinel configs
  runtime/users.acl          generated, do not commit secrets
scripts/
  generate-redis-acl.sh
prisma/                      Todo model and migration
```

## What you can practice here

Connection pooling, cache-aside, TTL and jitter, key design, invalidation, consistency, stampede protection, Lua, `SET NX`, distributed locks, avalanche, serialization, penetration, memory limits, eviction, Redis failure, RDB versus AOF, RPO and RTO, sessions, sticky-session style server state moved into Redis, `MULTI`/`EXEC`, absolute and sliding expiration, rate limiting, replication, and Sentinel failover.

Still open in `Topic_to_cover.txt`: lazy and periodic expiry, keyspace notifications, write-through, write-behind, Pub/Sub, Streams, and Cluster.

## License

ISC. See `package.json`.
