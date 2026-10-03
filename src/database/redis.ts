import "dotenv/config";

import {
  createClient,
  createSentinel,
} from "redis";

const redisMode =
  process.env.REDIS_MODE ??
  "standalone";

const redisUrl =
  process.env.REDIS_URL;

function createStandaloneRedis() {
  if (!redisUrl) {
    throw new Error(
      "REDIS_URL is not defined",
    );
  }

  return createClient({
    url: redisUrl,

    name:
      process.env
        .REDIS_CLIENT_NAME ??
      "todo-api",
  });
}

function createSentinelRedis() {
  const name =
    process.env
      .REDIS_SENTINEL_NAME;

  if (!name) {
    throw new Error(
      "REDIS_SENTINEL_NAME is not defined",
    );
  }

  const roots = [
    {
      host:
        process.env
          .REDIS_SENTINEL_1_HOST ??
        "127.0.0.1",

      port:
        Number(
          process.env
            .REDIS_SENTINEL_1_PORT ??
            26379,
        ),
    },

    {
      host:
        process.env
          .REDIS_SENTINEL_2_HOST ??
        "127.0.0.1",

      port:
        Number(
          process.env
            .REDIS_SENTINEL_2_PORT ??
            26380,
        ),
    },

    {
      host:
        process.env
          .REDIS_SENTINEL_3_HOST ??
        "127.0.0.1",

      port:
        Number(
          process.env
            .REDIS_SENTINEL_3_PORT ??
            26381,
        ),
    },
  ];

  return createSentinel({
    name,

    sentinelRootNodes:
      roots,

    nodeAddressMap(
      address,
    ) {
      const separator =
        address.lastIndexOf(
          ":",
        );

      const port =
        Number(
          address.slice(
            separator + 1,
          ),
        );

      return {
        host: "127.0.0.1",
        port,
      };
    },

    masterPoolSize: 1,

    replicaPoolSize: 0,

    passthroughClientErrorEvents:
      true,
  });
}

function createRedis() {
  if (
    redisMode ===
    "sentinel"
  ) {
    const client =
      createSentinelRedis();

    client.on(
      "topology-change",
      (event) => {
        console.log(
          "[REDIS TOPOLOGY CHANGE]",
          event,
        );
      },
    );

    return client;
  }

  return createStandaloneRedis();
}

export const redis =
  createRedis();

redis.on(
  "error",
  (error) => {
    console.error(
      "[REDIS ERROR]",
      error,
    );
  },
);

redis.on(
  "connect",
  () => {
    console.log(
      "[REDIS] Connecting",
    );
  },
);

redis.on(
  "ready",
  () => {
    console.log(
      "[REDIS] Ready",
    );
  },
);

redis.on(
  "reconnecting",
  () => {
    console.log(
      "[REDIS] Reconfiguring/reconnecting",
    );
  },
);

redis.on(
  "end",
  () => {
    console.log(
      "[REDIS] Connection closed",
    );
  },
);