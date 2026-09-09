import express from "express";

import { errorMiddleware } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";
import { todoRouter } from "./routes/todo.routes.js";
import { requestTimingMiddleware } from "./middleware/request-timing.middleware.js";
import { readinessCheck } from "./controllers/health.controller.js";

export const app = express();

app.use(express.json());

app.use(requestTimingMiddleware);

app.get("/health", (_req, res) => {
    res.status(200).json({
        success: true,
        message: "Todo Redis Lab API is healthy",
    });
});

app.get("/health/live", (_req, res) => {
    res.status(200).json({
        status: "alive",
    });
});

app.get("/health/ready", readinessCheck);

app.use("/api/v1/todos", todoRouter);

app.use(notFoundMiddleware);

app.use(errorMiddleware);