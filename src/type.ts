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
    sshKeyDir: string;
    versions: OVMDarwinOptions["originPath"]
}

export interface OVMEventData {
    ready: void,
    close: void,
    vmPause: void,
    vmResume: void,
    error: Error,
}

export interface OVMInfo {
    podmanPort: number;
    sshPort: number;
}

/**
 * @see https://github.com/Code-Hex/vz/blob/bd29a7ea3d39465c4224bfb01e990e8c220a8449/virtualization.go#L23
 */
export enum OVMVfkitState {
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

export interface OVMVfkitFullState {
    state: OVMVfkitState;
    canPause: boolean;
    canResume: boolean;
    canStop: boolean;
    canHardStop: boolean;
}
