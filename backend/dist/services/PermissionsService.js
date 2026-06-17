import { NotFoundError } from "../domain/errors.js";
export class PermissionsService {
    groups;
    cache = new Map();
    TTL_MS = 60_000;
    constructor(groups) {
        this.groups = groups;
    }
    async resolvePermissions(profileId) {
        const cached = this.cache.get(profileId);
        if (cached && Date.now() < cached.expiresAt)
            return cached.permissions;
        const allGroups = await this.groups.findAll();
        const permissions = new Set();
        for (const group of allGroups) {
            if (group.profileIds.includes(profileId)) {
                for (const perm of group.permissions) {
                    permissions.add(perm);
                }
            }
        }
        const result = [...permissions];
        this.cache.set(profileId, { permissions: result, expiresAt: Date.now() + this.TTL_MS });
        return result;
    }
    async hasPermission(profileId, permission) {
        const perms = await this.resolvePermissions(profileId);
        return perms.includes("admin") || perms.includes(permission);
    }
    async hasAnyPermission(profileId, ...permissions) {
        const perms = await this.resolvePermissions(profileId);
        if (perms.includes("admin"))
            return true;
        return permissions.some((p) => perms.includes(p));
    }
    async hasAllPermissions(profileId, ...permissions) {
        const perms = await this.resolvePermissions(profileId);
        if (perms.includes("admin"))
            return true;
        return permissions.every((p) => perms.includes(p));
    }
    invalidateCache(profileId) {
        if (profileId !== undefined) {
            this.cache.delete(profileId);
        }
        else {
            this.cache.clear();
        }
    }
    async listGroups() {
        return this.groups.findAll();
    }
    async getGroup(id) {
        const group = await this.groups.findById(id);
        if (!group)
            throw new NotFoundError("PermissionGroup");
        return group;
    }
    async createGroup(input) {
        const existing = await this.groups.findByName(input.name);
        if (existing)
            throw new NotFoundError("PermissionGroup name already exists");
        const group = await this.groups.create(input);
        this.cache.clear();
        return group;
    }
    async updateGroup(id, input) {
        const group = await this.groups.update(id, input);
        this.cache.clear();
        return group;
    }
    async deleteGroup(id) {
        await this.groups.delete(id);
        this.cache.clear();
    }
    async addProfileToGroup(groupId, profileId) {
        const group = await this.groups.addProfile(groupId, profileId);
        this.cache.clear();
        return group;
    }
    async removeProfileFromGroup(groupId, profileId) {
        const group = await this.groups.removeProfile(groupId, profileId);
        this.cache.clear();
        return group;
    }
}
//# sourceMappingURL=PermissionsService.js.map