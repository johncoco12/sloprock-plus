import { container } from "tsyringe";
import { config } from "./config.js";
import { MinIOProvider } from "./infrastructure/provider/storage/MinIOProvider.js";
import { ProfileRepository } from "./infrastructure/db/ProfileRepository.js";
import { PermissionGroupRepository } from "./infrastructure/db/PermissionGroupRepository.js";
import { StorageService } from "./services/StorageService.js";
import { ProfileService } from "./services/ProfileService.js";
import { PermissionsService } from "./services/PermissionsService.js";
import { TrackRepository } from "./infrastructure/db/TrackRepository.js";
import { TrackDataRepository } from "./infrastructure/db/TrackDataRepository.js";
import { StemsRepository } from "./infrastructure/db/StemsRepository.js";
import { StemDataRepository } from "./infrastructure/db/StemDataRepository.js";
import { LoopRepository } from "./infrastructure/db/LoopRepository.js";
import { TrackScoreRepository } from "./infrastructure/db/TrackScoreRepository.js";
import { IStorageProviderToken, IStorageServiceToken, IProfileServiceToken, IPermissionsServiceToken, IProfileRepositoryToken, IPermissionGroupRepositoryToken, ITrackRepositoryToken, ITrackDataRepositoryToken, IStemsRepositoryToken, IStemDataRepositoryToken, ILoopRepositoryToken, ITrackScoreRepositoryToken, } from "./tokens.js";
export { IStorageProviderToken, IStorageServiceToken, IProfileServiceToken, IPermissionsServiceToken, IProfileRepositoryToken, IPermissionGroupRepositoryToken, ITrackRepositoryToken, ITrackDataRepositoryToken, IStemsRepositoryToken, IStemDataRepositoryToken, ILoopRepositoryToken, ITrackScoreRepositoryToken, };
export function registerContainer() {
    container.register(IStorageProviderToken, {
        useFactory: () => new MinIOProvider({
            endPoint: config.minioEndpoint ?? "localhost",
            port: config.minioPort,
            accessKey: config.minioAccessKey,
            secretKey: config.minioSecretKey,
            bucket: config.minioBucket,
            useSSL: config.minioUseSSL,
        }),
    });
    container.register(IStorageServiceToken, {
        useFactory: (c) => new StorageService(c.resolve(IStorageProviderToken)),
    });
    container.register(IProfileRepositoryToken, {
        useFactory: () => new ProfileRepository(),
    });
    container.register(IPermissionGroupRepositoryToken, {
        useFactory: () => new PermissionGroupRepository(),
    });
    container.register(ITrackRepositoryToken, {
        useFactory: () => new TrackRepository(),
    });
    container.register(ITrackDataRepositoryToken, {
        useFactory: () => new TrackDataRepository(),
    });
    container.register(IStemsRepositoryToken, {
        useFactory: () => new StemsRepository(),
    });
    container.register(IStemDataRepositoryToken, {
        useFactory: () => new StemDataRepository(),
    });
    container.register(ILoopRepositoryToken, {
        useFactory: () => new LoopRepository(),
    });
    container.register(ITrackScoreRepositoryToken, {
        useFactory: () => new TrackScoreRepository(),
    });
    container.register(IProfileServiceToken, {
        useFactory: (c) => new ProfileService(c.resolve(IProfileRepositoryToken)),
    });
    container.register(IPermissionsServiceToken, {
        useFactory: (c) => new PermissionsService(c.resolve(IPermissionGroupRepositoryToken)),
    });
    return container;
}
//# sourceMappingURL=container.js.map