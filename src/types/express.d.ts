import { SessionData } from "./session";

declare global {
    namespace Express {
        interface Request {
            auth?: {
                sessionId: string;
                session: SessionDats;
            };
        }
    }
}

export { };


/*
declare global: This tells TypeScript to inject types into the global scope. Because Express is an external library, you have to break into its global type definitions to add your own modifications.

namespace Express + interface Request: This utilizes a feature called declaration merging. TypeScript finds the existing Request interface provided by the Express library and merges your custom definition directly into it.

auth?:: This adds a new, optional (?) property named auth to the req object. It is optional because public routes (like login or register) won't have authentication data attached yet.

The auth Object Shape: When req.auth is present, TypeScript now enforces that it must contain exactly two things:
    sessionId: A string representing the active session ID.
    session: The full session payload object, structured according to your custom SessionData type imported from your ./session.js file.
    
export {};: This turns the file into a module. Without an export or import statement, TypeScript treats declaration files differently, which can sometimes break global augmentations.
*/