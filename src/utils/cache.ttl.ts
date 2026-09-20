export function addTtlJitter (
    baseTtlSeconds: number,
    jitterSeconds: number,
): number {
    if (jitterSeconds <= 0) {
        return baseTtlSeconds;
    }

    const jitter = Math.floor(
        Math.random() * (jitterSeconds + 1),
    );

    return baseTtlSeconds + jitter;
}