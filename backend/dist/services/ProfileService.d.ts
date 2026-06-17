import type { IProfileRepository } from "../domain/repositories.js";
import type { CreateProfileInput, UpdateProfileInput } from "../domain/models/profile.js";
import type { IProfileService, SafeProfile, Session } from "../domain/interfaces/services/IProfileService.js";
export declare class ProfileService implements IProfileService {
    private readonly profiles;
    private sessions;
    private failedAttempts;
    constructor(profiles: IProfileRepository);
    listProfiles(): Promise<SafeProfile[]>;
    getProfile(id: number): Promise<SafeProfile>;
    createProfile(input: CreateProfileInput): Promise<SafeProfile>;
    updateProfile(id: number, input: UpdateProfileInput): Promise<SafeProfile>;
    deleteProfile(id: number): Promise<void>;
    login(name: string, pin: string): Promise<{
        session: Session;
        profile: SafeProfile;
    }>;
    recoverProfile(name: string, recoveryPhrase: string, newPin: string): Promise<SafeProfile>;
    validateSession(token: string): Session | null;
    logout(token: string): void;
    getPermissions(profileId: number): Promise<string[]>;
    isSetup(): Promise<boolean>;
}
//# sourceMappingURL=ProfileService.d.ts.map