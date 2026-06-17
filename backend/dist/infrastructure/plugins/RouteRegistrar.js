import { requireAuthAsync, requirePermissionStr } from "../../api/middleware/auth.js";
export class RouteRegistrar {
    fastify;
    constructor(fastify) {
        this.fastify = fastify;
    }
    forPlugin(pluginId) {
        const fastify = this.fastify;
        return {
            register(method, path, handler, opts) {
                const preHandler = [
                    requireAuthAsync(),
                    ...(opts?.requirePermission ? [requirePermissionStr(opts.requirePermission)] : []),
                ];
                fastify.route({
                    method,
                    url: `/api/plugins/${pluginId}/${path}`,
                    preHandler,
                    handler,
                });
            },
            ws(path, handler) {
                fastify.get(`/ws/plugins/${pluginId}/${path}`, { websocket: true, preHandler: [requireAuthAsync()] }, handler);
            },
        };
    }
}
//# sourceMappingURL=RouteRegistrar.js.map