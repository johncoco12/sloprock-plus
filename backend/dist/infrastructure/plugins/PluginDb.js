import { prisma } from "../db/client.js";
export class PluginDbStore {
    pluginId;
    constructor(pluginId) {
        this.pluginId = pluginId;
    }
    async get(key) {
        const row = await prisma.pluginData.findUnique({
            where: { pluginId_key: { pluginId: this.pluginId, key } },
        });
        return row?.value ?? null;
    }
    async set(key, value) {
        await prisma.pluginData.upsert({
            where: { pluginId_key: { pluginId: this.pluginId, key } },
            create: { pluginId: this.pluginId, key, value },
            update: { value },
        });
    }
    async delete(key) {
        await prisma.pluginData.deleteMany({
            where: { pluginId: this.pluginId, key },
        });
    }
    async list() {
        const rows = await prisma.pluginData.findMany({
            where: { pluginId: this.pluginId },
            select: { key: true, value: true },
        });
        return rows;
    }
}
export class PluginDbFactory {
    forPlugin(pluginId) {
        return new PluginDbStore(pluginId);
    }
    async purgePlugin(pluginId) {
        await prisma.pluginData.deleteMany({ where: { pluginId } });
    }
}
//# sourceMappingURL=PluginDb.js.map