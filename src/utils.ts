import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const resourcesPath = join(__dirname, "..", "vm-resources");

export const resource = (name: "rootfs" | "initrd" | "kernel" | "ovm"): string => {
    switch (name) {
        case "rootfs": {
            const file = process.platform === "darwin" ? "rootfs.erofs" : "rootfs.zst";
            return join(resourcesPath, file);
        }
        case "initrd": {
            return join(resourcesPath, "initrd.gz");
        }
        case "kernel": {
            const file = process.arch === "x64" ? "bzImage" : "Image";
            return join(resourcesPath, file);
        }
        case "ovm": {
            const file = process.platform === "darwin" ? "ovm" : "ovm.exe";
            return join(resourcesPath, file);
        }
    }
};
