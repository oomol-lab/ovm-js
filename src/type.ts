export interface OVMDarwinOptions {
    name: string;
    cpu: number;
    memory: number;
    ovmPath: string;
    linuxPath: {
        initrd: string;
        kernel: string;
        rootfs: string;
    };
    targetDir: string;
    socketDir: string;
    logDir: string;
    sshKeyDir: string;
    versions: OVMDarwinOptions["linuxPath"] & { dataImg: string; };
    powerSaveMode: boolean;
    extendShareDir?: string,
}

export enum OVMDarwinStatusName {
    Initializing = "Initializing",
    GVProxyReady = "GVProxyReady",
    IgnitionProgress = "IgnitionProgress",
    IgnitionDone = "IgnitionDone",
    VMReady = "VMReady",
    Exit = "Exit",
    Error = "Error",
}

export interface OVMDarwinEventData {
    status: {
        name: OVMDarwinStatusName,
        message: string,
    }
}

export interface OVMDarwinInfo {
    podmanSocketPath: string;
}

/**
 * @see https://github.com/Code-Hex/vz/blob/bd29a7ea3d39465c4224bfb01e990e8c220a8449/virtualization.go#L23
 */
export enum OVMDarwinVzState {
    VirtualMachineStateStopped = "VirtualMachineStateStopped",
    VirtualMachineStateRunning = "VirtualMachineStateRunning",
    VirtualMachineStatePaused = "VirtualMachineStatePaused",
    VirtualMachineStateError = "VirtualMachineStateError",
    VirtualMachineStateStarting = "VirtualMachineStateStarting",
    VirtualMachineStatePausing = "VirtualMachineStatePausing",
    VirtualMachineStateResuming = "VirtualMachineStateResuming",
    VirtualMachineStateStopping = "VirtualMachineStateStopping",
    VirtualMachineStateSaving = "VirtualMachineStateSaving",
    VirtualMachineStateRestoring = "VirtualMachineStateRestoring",
}

export interface OVMDarwinState {
    state: OVMDarwinVzState;
    canStart: boolean;
    canPause: boolean;
    canResume: boolean;
    canRequestStop: boolean;
    CanStop: boolean;
}
