import fp from "fastify-plugin";
import { v4 as uuidv4 } from "uuid";
export const correlationId = fp(async function correlationId(fastify) {
    fastify.addHook("onRequest", async (req) => {
        const header = req.headers["x-correlation-id"];
        req.correlationId = typeof header === "string" ? header : uuidv4();
    });
    fastify.addHook("onSend", async (req, reply) => {
        reply.header("x-correlation-id", req.correlationId);
    });
});
//# sourceMappingURL=correlationId.js.map