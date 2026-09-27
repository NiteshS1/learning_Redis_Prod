export const sessionConfig = {
    cookieName: "sessionId",

    idleTtlSeconds: 30 * 60, // 30 minutes

    absoluteTtlSeconds: 24 * 60 * 60, // 24 hours

    cookie: {
        httpOnly: true,

        secure:
            process.env.NODE_ENV ===
            "production",

        sameSite: "lax" as const,

        path: "/",
    },
} as const;