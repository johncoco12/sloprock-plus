import type { IProfileRepository } from "../../domain/repositories.js";
import type { Profile, CreateProfileInput, UpdateProfileInput } from "../../domain/models/profile.js";
export declare class ProfileRepository implements IProfileRepository {
    findById(id: number): Promise<Profile | null>;
    findByName(name: string): Promise<Profile | null>;
    findAll(): Promise<Profile[]>;
    create(input: CreateProfileInput): Promise<Profile>;
    update(id: number, input: UpdateProfileInput): Promise<Profile>;
    delete(id: number): Promise<void>;
}
//# sourceMappingURL=ProfileRepository.d.ts.map