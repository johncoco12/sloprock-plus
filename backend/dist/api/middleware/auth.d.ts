import type { FastifyRequest, preHandlerAsyncHookHandler } from "fastify";
import type { Session } from "../../domain/interfaces/services/IProfileService.js";
import { Permissions } from "../../domain/models/permission.js";
export declare function requireAuth(req: FastifyRequest): Session;
export declare function requireAuthAsync(): preHandlerAsyncHookHandler;
export declare function requirePermission(...permissions: Permissions[]): preHandlerAsyncHookHandler;
export declare function requirePermissionStr(permission: string): preHandlerAsyncHookHandler;
export declare function requireAllPermissions(...permissions: Permissions[]): preHandlerAsyncHookHandler;
export declare const authMiddleware: (fastify: import("fastify").FastifyInstance<import("fastify").RawServerDefault, import("http").IncomingMessage, import("http").ServerResponse<import("http").IncomingMessage>, import("fastify").FastifyBaseLogger, import("fastify").FastifyTypeProviderDefault>) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map