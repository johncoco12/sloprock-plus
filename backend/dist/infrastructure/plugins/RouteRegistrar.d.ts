import type { FastifyInstance } from "fastify";
import type { PluginRouteHandle } from "../../domain/interfaces/plugins/PluginContext.js";
export declare class RouteRegistrar {
    private readonly fastify;
    constructor(fastify: FastifyInstance);
    forPlugin(pluginId: string): PluginRouteHandle;
}
//# sourceMappingURL=RouteRegistrar.d.ts.map