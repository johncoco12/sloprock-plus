import type { SacSessionService } from "./SacSessionService.js";
export declare class PitchProcessorService {
    private readonly sessionSvc;
    private socket;
    constructor(sessionSvc: SacSessionService);
    start(): void;
    stop(): void;
    private handleMessage;
}
//# sourceMappingURL=PitchProcessorService.d.ts.map