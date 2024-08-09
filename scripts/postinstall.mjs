import fs from "node:fs";
import fsP from "node:fs/promises";
import got from "got";
import { join, dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJSON = JSON.parse(fs.readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
const coreVersion = packageJSON.ovm[process.platform]?.core;
const ovmVersion = packageJSON.ovm[process.platform]?.ovm;

const binName = process.platform === "win32" ? "ovm.exe" : "ovm";

const assets = {
    x64: {
        core: [],
        ovm: "",
    },
    arm64: {
        core: [],
        ovm: "",
    },
}

switch (process.platform) {
    case "darwin": {
        const coreURL = `https://github.com/oomol-lab/ovm-core/releases/download/${coreVersion}`;
        const ovmURL = `https://github.com/oomol-lab/ovm/releases/download/${ovmVersion}`;

        assets.x64.core.push(
            `${coreURL}/applehv-rootfs-amd64.rootfs.erofs#rootfs.erofs`,
            `${coreURL}/initrd-amd64.initrd.gz#initrd.gz`,
            `${coreURL}/kernel-amd64.bzImage#bzImage`
        );
        assets.x64.ovm = `${ovmURL}/ovm-amd64#${binName}`;

        assets.arm64.core.push(
            `${coreURL}/applehv-rootfs-arm64.rootfs.erofs#rootfs.erofs`,
            `${coreURL}/initrd-arm64.initrd.gz#initrd.gz`,
            `${coreURL}/kernel-arm64.Image#Image`,
        );
        assets.arm64.ovm = `${ovmURL}/ovm-arm64#${binName}`;

        break;
    }
    case "win32": {
        const coreURL = `https://github.com/oomol-lab/ovm-builder/releases/download/${coreVersion}`;
        const ovmURL = `https://github.com/oomol/ovm-win/releases/download/${ovmVersion}`;

        assets.x64.core.push(`${coreURL}/rootfs-amd64.zst#rootfs.zst`);
        assets.x64.ovm = `${ovmURL}/ovm-amd64.exe#${binName}`;

        if (process.arch !== "x64") {
            console.warn("[OVM]: Windows only supports x64 architecture");
            process.exit(0);
        }

        break;
    }
    default: {
        console.warn("[OVM]: Currently only supports macOS and Windows");
        process.exit(0);
    }
}

const vmResourcesPath = join(__dirname, "..", "vm-resources");
await fsP.mkdir(vmResourcesPath, { recursive: true });

const tasks = [...assets[process.arch].core, assets[process.arch].ovm];

await Promise.all(
    tasks.map(t => {
        const [url, filename] = t.split("#");
        const outputPath = join(vmResourcesPath, filename);
        console.log("[OVM]: Downloading", url, "to", outputPath);
        return pipeline(got.stream(url), fs.createWriteStream(outputPath)).then(
            () => {
                console.log(`[OVM]: Downloaded ${outputPath}`);
            }
        );
    })
);

const ovmStat = await fsP.stat(join(vmResourcesPath, binName));
if (!(ovmStat.mode & fs.constants.X_OK)) {
    await fsP.chmod(join(vmResourcesPath, binName), 0o755);
}

console.log("[OVM]: Downloaded successfully");
