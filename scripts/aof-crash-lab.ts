import { createClient } from "redis";

const redis = createClient({
    url:
        process.env.REDIS_URL ??
        "redis://:todo_password@localhost:6379",
});

redis.on("error", (error) => {
    console.error(
        "[REDIS ERROR]",
        error,
    );
});

async function main() {
    await redis.connect();

    for (let i = 0; i < 10000; i++) {
        await redis.set(
            `aof:crash:${i}`,
            `value-${i}`,
        );

        if (i % 100 === 0) {
            console.log(
                `Written ${i}`,
            );
        }
    }

    await redis.close();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});