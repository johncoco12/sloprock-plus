import dgram from "node:dgram";
import { SAC_PITCH_PORT } from "./types.js";
const MIN_CONFIDENCE = 0.80; // discard packets below this threshold
// Receives the high-frequency PITCH UDP stream from SlopAudio-Connect
// (port 54922) and forwards it to the linked WebSocket frontend client.
//
// Note-hit detection is intentionally left to the frontend for now;
// this service is the transport bridge.
export class PitchProcessorService {
    sessionSvc;
    socket = null;
    constructor(sessionSvc) {
        this.sessionSvc = sessionSvc;
    }
    start() {
        this.socket = dgram.createSocket("udp4");
        this.socket.on("error", (err) => {
            console.error("[PitchProcessor] socket error:", err.message);
        });
        this.socket.on("message", (msg, rinfo) => this.handleMessage(msg, rinfo));
        this.socket.bind(SAC_PITCH_PORT, () => {
            console.info(`[PitchProcessor] listening on UDP :${SAC_PITCH_PORT}`);
        });
    }
    stop() {
        this.socket?.close();
        this.socket = null;
    }
    handleMessage(msg, rinfo) {
        let data;
        try {
            data = JSON.parse(msg.toString());
        }
        catch {
            return;
        }
        if (data.type !== "PITCH" || !data.sessionId)
            return;
        if (data.confidence < MIN_CONFIDENCE)
            return;
        // Reject pitch datagrams whose sender IP does not match the authenticated SAC endpoint
        if (!this.sessionSvc.validatePitchSource(data.sessionId, rinfo.address))
            return;
        const event = {
            type: "sac:pitch",
            ts: data.ts,
            frequency: data.frequency,
            confidence: data.confidence,
            midiNote: data.midiNote,
            noteName: data.noteName,
        };
        this.sessionSvc.forwardPitch(data.sessionId, event);
    }
}
//# sourceMappingURL=PitchProcessorService.js.map