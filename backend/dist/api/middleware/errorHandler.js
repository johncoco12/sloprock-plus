import fp from "fastify-plugin";
import { ZodError } from "zod";
import { AppError } from "../../domain/errors.js";
export const errorHandler = fp(async function errorHandler(fastify) {
    fastify.setErrorHandler((err, _req, reply) => {
        if (err instanceof AppError) {
            return reply.code(err.statusCode).send({ error: err.message });
        }
        if (err instanceof ZodError) {
            const first = err.issues[0];
            const message = first ? `${first.path.join(".")}: ${first.message}` : "Validation error";
            return reply.code(400).send({ error: message });
        }
        if (err.statusCode === 400) {
            return reply.code(400).send({ error: err.message });
        }
        fastify.log.error(err);
        return reply.code(500).send({ error: "Internal server error" });
    });
});
//# sourceMappingURL=errorHandler.js.map