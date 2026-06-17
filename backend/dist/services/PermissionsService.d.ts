import type { IPermissionGroupRepository } from "../domain/repositories.js";
import type { PermissionGroup, CreatePermissionGroupInput, UpdatePermissionGroupInput } from "../domain/models/permission.js";
import type { IPermissionsService } from "../domain/interfaces/services/IPermissionsService.js";
export declare class PermissionsService implements IPermissionsService {
    private readonly groups;
    private cache;
    private readonly TTL_MS;
    constructor(groups: IPermissionGroupRepository);
    resolvePermissions(profileId: number): Promise<string[]>;
    hasPermission(profileId: number, permission: string): Promise<boolean>;
    hasAnyPermission(profileId: number, ...permissions: string[]): Promise<boolean>;
    hasAllPermissions(profileId: number, ...permissions: string[]): Promise<boolean>;
    invalidateCache(profileId?: number): void;
    listGroups(): Promise<PermissionGroup[]>;
    getGroup(id: number): Promise<PermissionGroup>;
    createGroup(input: CreatePermissionGroupInput): Promise<PermissionGroup>;
    updateGroup(id: number, input: UpdatePermissionGroupInput): Promise<PermissionGroup>;
    deleteGroup(id: number): Promise<void>;
    addProfileToGroup(groupId: number, profileId: number): Promise<PermissionGroup>;
    removeProfileFromGroup(groupId: number, profileId: number): Promise<PermissionGroup>;
}
//# sourceMappingURL=PermissionsService.d.ts.map