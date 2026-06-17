export declare class AppError extends Error {
    readonly statusCode: number;
    constructor(message: string, statusCode?: number);
}
export declare class NotFoundError extends AppError {
    constructor(resource: string);
}
export declare class ValidationError extends AppError {
    constructor(message: string);
}
export declare class ConfigurationError extends AppError {
    constructor(message: string);
}
export declare class PathTraversalError extends AppError {
    constructor();
}
export declare class ExtractionError extends AppError {
    constructor(message: string);
}
export declare class AudioConversionError extends AppError {
    constructor(message: string);
}
export declare class DemoModeError extends AppError {
    constructor();
}
export declare class AuthenticationError extends AppError {
    constructor(message?: string);
}
export declare class InvalidCredentialsError extends AppError {
    constructor(message?: string);
}
export declare class AccountLockedError extends AppError {
    constructor(message?: string);
}
export declare class ForbiddenError extends AppError {
    constructor(message?: string);
}
//# sourceMappingURL=errors.d.ts.map