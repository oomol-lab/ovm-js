export interface OVMDarwinOptions {
    name: string;
    cpu: number;
    memory: number;
    ovmPath?: string;
    linuxPath?: {
        initrd?: string;
        kernel?: string;
        rootfs?: string;
    };
    targetDir: string;
    socketDir: string;
    logDir: string;
    sshKeyDir: string;
    versions: Required<OVMDarwinOptions["linuxPath"]> & { data: string; };
    powerSaveMode: boolean;
    extendShareDir?: string,
    cwd: string;
}

export enum OVMDarwinAppEventValue {
    Initializing = "Initializing",
    GVProxyReady = "GVProxyReady",
    IgnitionProgress = "IgnitionProgress",
    IgnitionDone = "IgnitionDone",
    Ready = "Ready",
}

export interface OVMDarwinEventData {
    app: OVMDarwinAppEventValue,
    error: string,
    exit: void,
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

// ----- windows

export interface OVMWindowsInfo {
    podmanHost: string;
    podmanPort: number;
}

export interface OVMWindowsOptions {
    name: string;
    ovmPath?: string;
    linuxPath?: {
        rootfs?: string;
    };
    imageDir: string;
    logDir: string;
    versions: Required<OVMWindowsOptions["linuxPath"]> & { data: string; };
    cwd: string;
}

export enum OVMWindowsPrepareEventValue {
    SystemNotSupport = "SystemNotSupport",

    NeedEnableFeature = "NeedEnableFeature",
    EnableFeaturing = "EnableFeaturing",
    EnableFeatureFailed = "EnableFeatureFailed",
    EnableFeatureSuccess = "EnableFeatureSuccess",
    NeedReboot = "NeedReboot",

    NeedUpdateWSL = "NeedUpdateWSL",
    UpdatingWSL = "UpdatingWSL",
    UpdateWSLFailed = "UpdateWSLFailed",
    UpdateWSLSuccess = "UpdateWSLSuccess",
}

export enum OVMWindowsRunEventValue {
    UpdatingRootFS = "UpdatingRootFS",
    UpdateRootFSFailed = "UpdateRootFSFailed",
    UpdateRootFSSuccess = "UpdateRootFSSuccess",

    UpdatingData = "UpdatingData",
    UpdateDataFailed = "UpdateDataFailed",
    UpdateDataSuccess = "UpdateDataSuccess",

    Starting = "Starting",
    Ready = "Ready",
}

export interface OVMWindowsEventData {
    run: OVMWindowsRunEventValue,
    prepare: OVMWindowsPrepareEventValue,
    error: string,
    exit: void,
}

