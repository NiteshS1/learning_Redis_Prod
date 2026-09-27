import { timingSafeEqual } from "node:crypto";
import { AppError } from "../types/app-error";
import { LoginInput } from "../validators/auth.validator";
import { SessionService } from "./session.service";

export class AuthService {
    constructor(
        private readonly sessionService: SessionService,
    ) { }

    private safeEqual (provided: string, expected: string) {
        const providedBuffer = Buffer.from(provided);
        const expectedBuffer = Buffer.from(expected);

        if (
            providedBuffer.length !== expectedBuffer.length
        ) {
            return false;
        }

        return timingSafeEqual(
            providedBuffer,
            expectedBuffer,
        );
    }

    async login (input: LoginInput) {
        const expectedEmail = process.env.DEMO_USER_EMAIL;
        const expectedPassword = process.env.DEMO_USER_PASSWORD;
        const userId = process.env.DEMO_USER_ID;

        if (
            !expectedEmail ||
            !expectedPassword ||
            !userId
        ) {
            throw new Error(
                "Demo authentication is not configured",
            );
        }

        const emailMatches = input.email === expectedEmail;

        const passwordMatches = this.safeEqual(input.password, expectedPassword);

        if (
            !emailMatches ||
            !passwordMatches
        ) {
            throw new AppError(
                "Invalid email or password",
                401,
                "INVALID_CREDENTIALS",
            );
        }

        return this.sessionService.createSession(userId);
    }
}