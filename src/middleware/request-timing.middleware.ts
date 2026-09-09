import type {
    NextFunction,
    Request,
    Response,
} from "express";

export function requestTimingMiddleware (
    req: Request,
    res: Response,
    next: NextFunction,
) {
    const start = performance.now();

    res.on("finish", () => {
        const duration =
            performance.now() - start;

        console.log(
            `[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration.toFixed(2)}ms`,
        );
    });

    next();
}