import fs from "node:fs";
import fsP from "node:fs/promises";
import got from "got";
import { join, dirname, basename } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import crypto from "node:crypto";
import { tgz } from "compressing";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const resourceJSON = JSON.parse(fs.readFileSync(join(__dirname, "..", "resource.json"), "utf-8"));

const info = resourceJSON[`${process.platform}-${process.arch}`];
if (!info) {
    const supportList = Object.keys(resourceJSON).map(item => item.split("-").join(" ")).join(", ");
    console.warn(`[OVM]: Currently only supports ${supportList}`);
    process.exit(0);
}

const cacheDir = join(homedir(), ".cache", "ovm");
const distDir = join(__dirname, "..", "vm-resources");
await fsP.mkdir(distDir, { recursive: true });

for (const { name, version, download: downloadTemplate, sha256, out } of info) {
    const downloadURL = downloadTemplate.replace(/\{version}/g, version);
    const cachePath = join(cacheDir, `${name}-${version}`, ...out.split("/"));
    await fsP.mkdir(dirname(cachePath), { recursive: true });

    await download(5)(downloadURL, cachePath, sha256);

    let distPath;
    if (out.endsWith(".tar.gz")) {
        distPath = join(distDir, out.replace(".tar.gz", ""));
        await fsP.rm(distPath, { force: true, recursive: true });
        await tgz.uncompress(cachePath, distPath)
    } else {
        distPath = join(distDir, out);
        await fsP.rm(distPath, { force: true, recursive: true });
        await fsP.mkdir(dirname(distPath), { recursive: true });
        await fsP.copyFile(cachePath, distPath);
    }

    console.log(`[OVM]: Downloaded ${distPath}`);
}

const files = await fsP.readdir(distDir, { withFileTypes: true, recursive: true });
for (const file of files) {
    if (file.isDirectory()) {
        continue;
    }
    if (["gvproxy", "krunkit", "ovm", "ovm.exe"].includes(file.name)) {
        await fsP.chmod(join(file.path, file.name), 0o755);
    }
}

console.log("[OVM]: Downloaded successfully");

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
