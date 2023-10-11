export interface OVMDarwinOptions {
    gvproxyPath: string;
    vfkitPath: string;
    vfkitSocketPath: string;
    vfkitRestfulSocketPath: string;
    networkSocketPath: string;
    initrdPath: string;
    kernelPath: string;
    rootfsPath: string;
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
