import "dotenv/config";
import {
    createClient,
} from "redis";

const redis =
    createClient({
        url:
            process.env.REDIS_URL ??
            "redis://localhost:6379",
    });

redis.on(
    "error",
    (error) => {
        console.error(
            "[REDIS ERROR]",
            error,
        );
    },
);

async function printSection(
    name: string,
) {
    console.log(
        `\n========== ${name.toUpperCase()} ==========\n`,
    );

    console.log(
        await redis.info(name),
    );
}

async function main() {
    await redis.connect();

    await printSection(
        "server",
    );

    await printSection(
        "clients",
    );

    await printSection(
        "memory",
    );

    await printSection(
        "stats",
    );

    await printSection(
        "persistence",
    );

    await printSection(
        "commandstats",
    );

    await printSection(
        "latencystats",
    );

    await printSection(
        "keyspace",
    );

    await redis.close();
}

main().catch(
    (error) => {
        console.error(error);
        process.exit(1);
    },
);