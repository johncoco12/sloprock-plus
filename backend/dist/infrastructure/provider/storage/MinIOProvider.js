import * as Minio from "minio";
import { S3Error } from "minio";
import fs from "node:fs";
import { mimeFromFile } from "../../../utils/mime.js";
export class MinIOProvider {
    name = "MinIO";
    client;
    bucket;
    bucketReady = false;
    constructor(opts) {
        this.bucket = opts.bucket ?? "slopsmith";
        this.client = new Minio.Client({
            endPoint: opts.endPoint,
            port: opts.port,
            accessKey: opts.accessKey ?? "",
            secretKey: opts.secretKey ?? "",
            useSSL: opts.useSSL ?? false,
        });
    }
    async ensureBucket() {
        if (this.bucketReady)
            return;
        const exists = await this.client.bucketExists(this.bucket);
        if (!exists) {
            await this.client.makeBucket(this.bucket);
        }
        this.bucketReady = true;
    }
    async store(identifier, data) {
        await this.ensureBucket();
        const mimeType = mimeFromFile(identifier);
        await this.client.putObject(this.bucket, identifier, data, data.length, {
            "Content-Type": mimeType,
        });
        return { identifier, mimeType, size: data.length };
    }
    async storeFromPath(identifier, sourcePath) {
        await this.ensureBucket();
        const mimeType = mimeFromFile(identifier);
        const stat = fs.statSync(sourcePath);
        await this.client.fPutObject(this.bucket, identifier, sourcePath, {
            "Content-Type": mimeType,
        });
        return { identifier, mimeType, size: stat.size };
    }
    async get(identifier) {
        await this.ensureBucket();
        try {
            const stream = await this.client.getObject(this.bucket, identifier);
            return await streamToBuffer(stream);
        }
        catch (err) {
            if (isNoSuchKeyError(err))
                return null;
            throw err;
        }
    }
    async delete(identifier) {
        await this.ensureBucket();
        await this.client.removeObject(this.bucket, identifier);
    }
    async exists(identifier) {
        await this.ensureBucket();
        try {
            await this.client.statObject(this.bucket, identifier);
            return true;
        }
        catch (err) {
            if (isNoSuchKeyError(err))
                return false;
            throw err;
        }
    }
}
function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
    });
}
function isNoSuchKeyError(err) {
    if (err instanceof S3Error && err.code === "NoSuchKey")
        return true;
    if (err instanceof Error) {
        if ("code" in err && err.code === "NoSuchKey")
            return true;
        if (err.message?.includes("The specified key does not exist"))
            return true;
    }
    return false;
}
//# sourceMappingURL=MinIOProvider.js.map