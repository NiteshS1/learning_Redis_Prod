import { createClient } from "redis";

const redis = createClient({
    url:
        process.env.REDIS_URL ??
        "redis://localhost:6379",
});

async function main () {
    await redis.connect();

    const memory =
        await redis.info("memory");

    const stats =
        await redis.info("stats");

    const keyspace =
        await redis.info("keyspace");

    console.log(
        "\n=== MEMORY ===\n",
    );

    console.log(memory);

    console.log(
        "\n=== STATS ===\n",
    );

    console.log(stats);

    console.log(
        "\n=== KEYSPACE ===\n",
    );

    console.log(keyspace);

    await redis.close();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});