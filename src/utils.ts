import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { OVMDarwinOptions, OVMWindowsOptions } from "./type";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const resourcesPath = join(__dirname, "..", "vm-resources");

export const resource = (name: "rootfs" | "ovm" | "image", resource: OVMDarwinOptions["resource"] | OVMWindowsOptions["resource"]): string => {
    if (typeof resource !== "string" && resource?.[name] !== undefined) {
        return resource[name];
    }

    const path = typeof resource === "string" ? resource : resourcesPath;

    switch (name) {
        case "rootfs": {
            if (process.platform === "win32") {
                return join(path, "rootfs.zst");
            }

            throw new Error("Not supported rootfs in Darwin");
        }

        case "ovm": {
            if (process.platform === "win32") {
                return join(path, "ovm.exe");
            }

            return join(path, "bin", "ovm");
        }

        case "image": {
            if (process.platform === "darwin") {
                return join(path, "bootable.img.zst");
            }

            throw new Error("Not supported image in Windows");
        }
    }
};

export const enableDebug = (): boolean => {
    return !!(process.env.DEBUG?.includes("ovm") || process.env.OVM_DEBUG);
};
