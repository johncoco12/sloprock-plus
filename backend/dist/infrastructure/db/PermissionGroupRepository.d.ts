import type { IPermissionGroupRepository } from "../../domain/repositories.js";
import type { PermissionGroup, CreatePermissionGroupInput, UpdatePermissionGroupInput } from "../../domain/models/permission.js";
export declare class PermissionGroupRepository implements IPermissionGroupRepository {
    findById(id: number): Promise<PermissionGroup | null>;
    findByName(name: string): Promise<PermissionGroup | null>;
    findAll(): Promise<PermissionGroup[]>;
    create(input: CreatePermissionGroupInput): Promise<PermissionGroup>;
    update(id: number, input: UpdatePermissionGroupInput): Promise<PermissionGroup>;
    delete(id: number): Promise<void>;
    addProfile(groupId: number, profileId: number): Promise<PermissionGroup>;
    removeProfile(groupId: number, profileId: number): Promise<PermissionGroup>;
}
//# sourceMappingURL=PermissionGroupRepository.d.ts.map