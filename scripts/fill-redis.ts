import { createClient } from "redis";

const redis = createClient({
    url:
        process.env.REDIS_URL ??
        "redis://localhost:6379",
});

redis.on("error", (error) => {
    console.error(
        "[REDIS ERROR]",
        error,
    );
});

const VALUE_SIZE =
    Number(process.env.VALUE_SIZE) ||
    10_000;

const KEY_COUNT =
    Number(process.env.KEY_COUNT) ||
    10_000;

async function main () {
    await redis.connect();

    const payload =
        "x".repeat(VALUE_SIZE);

    console.log(
        `Writing ${KEY_COUNT} keys`,
    );

    console.log(
        `Approx payload per key: ${VALUE_SIZE} bytes`,
    );

    for (
        let i = 0;
        i < KEY_COUNT;
        i++
    ) {
        try {
            await redis.set(
                `memory:test:${i}`,
                payload,
            );

            if (i % 100 === 0) {
                console.log(
                    `Written: ${i}`,
                );
            }
        } catch (error) {
            console.error(
                `Write failed at key ${i}`,
            );

            console.error(error);

            break;
        }
    }

    await redis.close();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});