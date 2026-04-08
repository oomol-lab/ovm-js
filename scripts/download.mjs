import fs from "node:fs";
import fsP from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import crypto from "node:crypto";
import { tgz } from "compressing";
import { EnvHttpProxyAgent, request, setGlobalDispatcher } from "undici";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const resourceJSON = JSON.parse(fs.readFileSync(join(__dirname, "resource.json"), "utf-8"));

const info = resourceJSON[`${process.platform}-${process.arch}`];
if (!info) {
    const supportList = Object.keys(resourceJSON).map(item => item.split("-").join(" ")).join(", ");
    console.warn(`[OVM]: Currently only supports ${supportList}`);
    process.exit(0);
}

let proxyInitialized = false;

const cacheDir = join(homedir(), ".cache", "ovm");
const distDir = join(__dirname, "vm-resources");
await fsP.mkdir(distDir, { recursive: true });

for (const { name, version, download: downloadTemplate, sha256, out } of info) {
    const downloadURL = downloadTemplate.replace(/\{version}/g, version);
    const cachePath = join(cacheDir, `${name}-${version}`, ...out.split("/"));
    await fsP.mkdir(dirname(cachePath), { recursive: true });

    await download(5)(downloadURL, cachePath, sha256);

    let distPath;
    if (out.endsWith(".tar.gz")) {
        distPath = distDir;
        const symlinks = await collectSymlinks(cachePath);
        await fsP.rm(distPath, { force: true, recursive: true });
        await fsP.mkdir(distPath, { recursive: true });
        await tgz.uncompress(cachePath, distPath);
        await fixSymlinks(distPath, symlinks);
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
    if (["gvproxy", "krunkit", "ovm", "ovm.exe"].includes(file.name) || file.name.endsWith(".dylib") || file.name.endsWith(".so")) {
        await fsP.chmod(join(file.parentPath, file.name), 0o755);
    }
}

console.log("[OVM]: Downloaded successfully");

async function collectSymlinks(tarPath) {
    const symlinks = new Map();
    await new Promise((resolve, reject) => {
        const stream = new tgz.UncompressStream({ source: tarPath });
        stream.on("entry", (header, fileStream, next) => {
            if (header.type === "symlink") {
                symlinks.set(header.name, header.linkname);
            }
            fileStream.resume();
            next();
        });
        stream.on("finish", resolve);
        stream.on("error", reject);
    });
    return symlinks;
}

async function fixSymlinks(dir, symlinks) {
    for (const [name, linkname] of symlinks) {
        const symlinkPath = join(dir, name);
        await fsP.rm(symlinkPath, { force: true, recursive: true });
        await fsP.symlink(linkname, symlinkPath);
    }
}

function download(retry) {
    initializeProxy();
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
            await downloadStream(url, output);
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


async function downloadStream(url, dest) {
    const { body, statusCode } = await request(url, {
        maxRedirections: 5,
    });

    if (statusCode < 200 || statusCode >= 300) {
        body.resume();
        throw new Error(`unexpected response ${statusCode}`);
    }

    const file = fs.createWriteStream(dest);
    await pipeline(body, file);
}

function initializeProxy() {
    if (proxyInitialized) {
        return;
    }
    proxyInitialized = true;

    try {
        if (
            !process.env.http_proxy
            && !process.env.HTTP_PROXY
            && !process.env.https_proxy
            && !process.env.HTTPS_PROXY
        ) {
            return;
        }

        setGlobalDispatcher(new EnvHttpProxyAgent());
    } catch (e) {
        console.warn("Could not configure undici proxy support:", e);
    }
}
