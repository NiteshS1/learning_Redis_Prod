import "dotenv/config";
import {
    createClient,
  } from "redis";
  
  const redis =
    createClient({
      url:
        process.env.REDIS_URL ??
        "redis://localhost:6379",
  
      name:
        "redis-health-check",
    });
  
  function parseInfo(
    info: string,
  ) {
    const result =
      new Map<string, string>();
  
    for (
      const line
      of info.split("\n")
    ) {
      if (
        !line ||
        line.startsWith("#")
      ) {
        continue;
      }
  
      const separator =
        line.indexOf(":");
  
      if (separator === -1) {
        continue;
      }
  
      const key =
        line.slice(
          0,
          separator,
        );
  
      const value =
        line
          .slice(
            separator + 1,
          )
          .trim();
  
      result.set(
        key,
        value,
      );
    }
  
    return result;
  }
  
  async function main() {
    await redis.connect();
  
    const [
      memoryRaw,
      statsRaw,
      clientsRaw,
      persistenceRaw,
    ] = await Promise.all([
      redis.info("memory"),
      redis.info("stats"),
      redis.info("clients"),
      redis.info(
        "persistence",
      ),
    ]);
  
    const memory =
      parseInfo(memoryRaw);
  
    const stats =
      parseInfo(statsRaw);
  
    const clients =
      parseInfo(clientsRaw);
  
    const persistence =
      parseInfo(
        persistenceRaw,
      );
  
    const hits =
      Number(
        stats.get(
          "keyspace_hits",
        ) ?? 0,
      );
  
    const misses =
      Number(
        stats.get(
          "keyspace_misses",
        ) ?? 0,
      );
  
    const totalLookups =
      hits + misses;
  
    const hitRatio =
      totalLookups === 0
        ? null
        : hits /
          totalLookups;
  
    const snapshot = {
      memory: {
        used:
          memory.get(
            "used_memory_human",
          ),
  
        peak:
          memory.get(
            "used_memory_peak_human",
          ),
  
        rss:
          memory.get(
            "used_memory_rss_human",
          ),
  
        max:
          memory.get(
            "maxmemory_human",
          ),
  
        policy:
          memory.get(
            "maxmemory_policy",
          ),
  
        fragmentation:
          memory.get(
            "mem_fragmentation_ratio",
          ),
      },
  
      clients: {
        connected:
          clients.get(
            "connected_clients",
          ),
  
        blocked:
          clients.get(
            "blocked_clients",
          ),
      },
  
      traffic: {
        opsPerSecond:
          stats.get(
            "instantaneous_ops_per_sec",
          ),
  
        inputKbps:
          stats.get(
            "instantaneous_input_kbps",
          ),
  
        outputKbps:
          stats.get(
            "instantaneous_output_kbps",
          ),
      },
  
      keys: {
        hits,
        misses,
  
        hitRatio:
          hitRatio === null
            ? null
            : Number(
                (
                  hitRatio *
                  100
                ).toFixed(2),
              ),
  
        expired:
          Number(
            stats.get(
              "expired_keys",
            ) ?? 0,
          ),
  
        evicted:
          Number(
            stats.get(
              "evicted_keys",
            ) ?? 0,
          ),
      },
  
      persistence: {
        rdbStatus:
          persistence.get(
            "rdb_last_bgsave_status",
          ),
  
        aofEnabled:
          persistence.get(
            "aof_enabled",
          ),
  
        aofRewrite:
          persistence.get(
            "aof_rewrite_in_progress",
          ),
  
        aofStatus:
          persistence.get(
            "aof_last_bgrewrite_status",
          ),
      },
    };
  
    console.log(
      JSON.stringify(
        snapshot,
        null,
        2,
      ),
    );
  
    await redis.close();
  }
  
  main().catch(
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );