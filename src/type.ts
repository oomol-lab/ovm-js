export interface OVMDarwinOptions {
    originPath: {
        gvproxy: string;
        vfkit: string;
        initrd: string;
        kernel: string;
        rootfs: string;
    };
    targetDir: string;
    socketDir: string;
    logDir: string;
}

export interface OVMEventData {
    ready: void,
    close: void,
    error: Error,
}

export interface OVMInfo {
    podmanPort: number;
    sshPort: number;
}
