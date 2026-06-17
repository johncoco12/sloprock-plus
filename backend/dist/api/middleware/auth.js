import fp from "fastify-plugin";
import { AuthenticationError, ForbiddenError } from "../../domain/errors.js";
export function requireAuth(req) {
    if (!req.session)
        throw new AuthenticationError();
    return req.session;
}
export function requireAuthAsync() {
    return async (req) => {
        requireAuth(req);
    };
}
export function requirePermission(...permissions) {
    return async (req) => {
        const session = requireAuth(req);
        const perms = req.server.permissions;
        const hasPermission = await perms.hasAnyPermission(session.profileId, ...permissions);
        if (!hasPermission) {
            throw new ForbiddenError(`Missing permission: ${permissions.join(", ")}`);
        }
    };
}
export function requirePermissionStr(permission) {
    return async (req) => {
        const session = requireAuth(req);
        const perms = req.server.permissions;
        const ok = await perms.hasAnyPermission(session.profileId, permission);
        if (!ok)
            throw new ForbiddenError(`Missing permission: ${permission}`);
    };
}
export function requireAllPermissions(...permissions) {
    return async (req) => {
        const session = requireAuth(req);
        const perms = req.server.permissions;
        const hasPermission = await perms.hasAllPermissions(session.profileId, ...permissions);
        if (!hasPermission) {
            throw new ForbiddenError(`Missing permissions: ${permissions.join(", ")}`);
        }
    };
}
export const authMiddleware = fp(async function authMiddleware(fastify) {
    fastify.addHook("preHandler", async (req) => {
        const auth = req.headers.authorization;
        let token = null;
        if (auth?.startsWith("Bearer ")) {
            token = auth.slice(7).trim();
        }
        // WebSocket upgrade requests cannot carry Authorization headers from the browser.
        // Accept the token via query string as a fallback (used by /ws/* routes).
        if (!token) {
            const q = req.query;
            if (typeof q.token === "string" && q.token)
                token = q.token;
        }
        if (!token) {
            req.session = null;
            return;
        }
        const profileService = fastify.profiles;
        const session = profileService.validateSession(token);
        req.session = session;
    });
});
//# sourceMappingURL=auth.js.map