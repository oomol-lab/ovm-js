import fs from "node:fs";
import fsP from "node:fs/promises";
import got from "got";
import { join, dirname, basename } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!["darwin", "win32"].includes(process.platform) || (process.platform === "win32" && process.arch !== "x64")) {
    console.warn("[OVM]: Currently only supports MacOS(arm64 and x64) and Windows(x64)");
    process.exit(0);
}

const packageJSON = JSON.parse(fs.readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

const tasks = [
    ...toTasks(packageJSON.ovm[`${process.platform}-core`], "core"),
    ...toTasks(packageJSON.ovm[`${process.platform}-ovm`], "ovm"),
];

const cacheDir = join(homedir(), ".cache", "ovm");
await fsP.mkdir(cacheDir, { recursive: true });

const vmResourcesPath = join(__dirname, "..", "vm-resources");
await fsP.mkdir(vmResourcesPath, { recursive: true });

for (const { url, outputName, sha256, version, type } of tasks) {
    const cache = join(cacheDir, `${type}-${version}`, outputName);
    await fsP.mkdir(dirname(cache), { recursive: true });

    await download(5)(url, cache, sha256);

    const outputPath = join(vmResourcesPath, outputName);
    await fsP.copyFile(cache, outputPath);
    console.log(`[OVM]: Downloaded ${outputPath}`);
}

const binName = process.platform === "win32" ? "ovm.exe" : "ovm";
const ovmStat = await fsP.stat(join(vmResourcesPath, binName));
if (!(ovmStat.mode & fs.constants.X_OK)) {
    await fsP.chmod(join(vmResourcesPath, binName), 0o755);
}

console.log("[OVM]: Downloaded successfully");

function toTasks (metadata, type) {
    return metadata.info[process.arch].map(f => {
        const [remoteFile, outputName, sha256] = f.split("#");
        return {
            url: `${metadata.endpoint}/${metadata.version}/${remoteFile}`,
            outputName,
            sha256,
            version: metadata.version,
            type,
        };
    })
}

function download(retry) {
    let r = retry;
    return async function doDownload(url, output, sha256, isRetry = false) {
        if (r === 0) {
            console.error("[OVM]: Failed to download the file");
            process.exit(1);
        }
        r--;

        if (fs.existsSync(output)) {
            const cacheHash = await computeHash(output);
            if (cacheHash === sha256) {
                isRetry || console.info(`[OVM]: Find ${basename(output)} in cache, hash matched`);
                return;
            }

            console.warn(`[OVM]: Hash mismatch for ${basename(output)}, Expected: ${sha256}, Actual: ${cacheHash}`);
            await fsP.rm(output, { force: true });
        }

        console.log("[OVM]: Downloading", url, "to", output);
        try {
            await pipeline(got.stream(url), fs.createWriteStream(output));
        } catch (_err) {
            console.warn("[OVM]: Download failed, retrying...");
            await new Promise(resolve => setTimeout(resolve, 1000));
            await fsP.rm(output, { force: true });
        }

        await doDownload(url, output, sha256, true);
    }
}

async function computeHash(filePath) {
    const input = fs.createReadStream(filePath);
    const hash = crypto.createHash("sha256");
    await pipeline(input, hash);
    return hash.digest("hex");
}
