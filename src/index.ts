import type { OVMDarwinOptions } from "./type";
import { DarwinOVM } from "./darwin";

export const createDarwinOVM = (options: OVMDarwinOptions): Promise<DarwinOVM> => {
    return DarwinOVM.create(options);
};

void (async () => {
    const ovm = await createDarwinOVM({
        gvproxyPath: "/Users/black-hole/Downloads/gvproxy",
        vfkitPath: "/usr/local/bin/vfkit",
        kernelPath: "/Users/black-hole/Code/vm/liushuai_home/bzImage",
        initrdPath: "/Users/black-hole/Code/vm/liushuai_home/initrd2",
        rootfsPath: "/Users/black-hole/Code/vm/liushuai_home/rootfs3.btrfs",
        vfkitSocketPath: "/tmp/vfkit-vsock-1024.sock",
        vfkitRestfulSocketPath: "/tmp/vfkit-restful.sock",
        networkSocketPath: "/tmp/network.sock",
        logDir: "/tmp/xxlog/",
    });

    console.time("x");
    ovm.on("ready", async () => {
        console.timeEnd("x");

        console.log("ready");
        await ovm.stop();
    });
    ovm.on("close", () => {
        console.log("close");
    });
    ovm.on("error", (error) => {
        console.timeEnd("x");
        console.log("error", error);
    });
    await ovm.start();
})();
