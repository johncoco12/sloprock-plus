export class AppError extends Error {
    statusCode;
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.name = this.constructor.name;
    }
}
export class NotFoundError extends AppError {
    constructor(resource) {
        super(`${resource} not found`, 404);
    }
}
export class ValidationError extends AppError {
    constructor(message) {
        super(message, 400);
    }
}
export class ConfigurationError extends AppError {
    constructor(message) {
        super(message, 500);
    }
}
export class PathTraversalError extends AppError {
    constructor() {
        super("Path traversal detected", 400);
    }
}
export class ExtractionError extends AppError {
    constructor(message) {
        super(message, 500);
    }
}
export class AudioConversionError extends AppError {
    constructor(message) {
        super(message, 500);
    }
}
export class DemoModeError extends AppError {
    constructor() {
        super("Demo mode: write operations are disabled", 403);
    }
}
export class AuthenticationError extends AppError {
    constructor(message = "Authentication required") {
        super(message, 401);
    }
}
export class InvalidCredentialsError extends AppError {
    constructor(message = "Invalid credentials") {
        super(message, 401);
    }
}
export class AccountLockedError extends AppError {
    constructor(message = "Account is locked") {
        super(message, 423);
    }
}
export class ForbiddenError extends AppError {
    constructor(message = "Insufficient permissions") {
        super(message, 403);
    }
}
//# sourceMappingURL=errors.js.map