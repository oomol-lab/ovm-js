import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { OVMDarwinArm64Options, OVMDarwinOptions, OVMWindowsOptions } from "./type";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const resourcesPath = join(__dirname, "..", "vm-resources");

export const resource = (name: "rootfs" | "initrd" | "kernel" | "ovm", resource: OVMDarwinOptions["resource"] | OVMWindowsOptions["resource"]): string => {
    if (typeof resource !== "string" && resource?.[name] !== undefined) {
        return resource[name];
    }

    const path = typeof resource === "string" ? resource : resourcesPath;

    switch (name) {
        case "rootfs": {
            const file = process.platform === "darwin" ? "rootfs.erofs" : "rootfs.zst";
            return join(path, file);
        }
        case "initrd": {
            return join(path, "initrd.gz");
        }
        case "kernel": {
            const file = process.arch === "x64" ? "bzImage" : "Image";
            return join(path, file);
        }
        case "ovm": {
            const file = process.platform === "darwin" ? "ovm" : "ovm.exe";
            return join(path, file);
        }
    }
};

export const resourceArm64 = (name: "ovm" | "image", resource: OVMDarwinArm64Options["resource"]): string => {
    if (typeof resource !== "string" && resource?.[name] !== undefined) {
        return resource[name];
    }

    const path = typeof resource === "string" ? resource : resourcesPath;

    switch (name) {
        case "ovm": {
            return join(path, "bin", "ovm");
        }
        case "image": {
            return join(path, "bootable.img.xz");
        }
    }
};

export const enableDebug = (): boolean => {
    return !!(process.env.DEBUG?.includes("ovm") || process.env.OVM_DEBUG);
};
