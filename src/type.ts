export interface OVMDarwinOptions {
    name: string;
    cpu: number;
    memory: number;
    resource?: {
        ovm?: string;
        initrd?: string;
        kernel?: string;
        rootfs?: string;
    } | string;
    targetDir: string;
    socketDir: string;
    logDir: string;
    sshKeyDir: string;
    versions:{
        initrd: string;
        kernel: string;
        rootfs: string;
        data: string;
    };
    bindPID?: number | string;
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
    podmanSocketPath: string,
    sshPort: number,
    sshUser: string,
    sshPublicKeyPath: string,
    sshPrivateKeyPath: string,
    sshPublicKey: string,
    sshPrivateKey: string,
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
    canStop: boolean;
}

// ----- darwin arm64
export interface OVMDarwinArm64Options {
    cpu: number;
    memory: number;
    resource?: {
        ovm?: string;
        image?: string;
    } | string;
    workspace: string;
    versions: {
        image: string;
        data: string;
    };
    bindPID?: number;
    appendVolume?: string[];
}

export interface OVMDarwinArm64InitEvent {
    decompress: "running" | "success";
    writeConfig: "running" | "success";
    exit: void;
    error: string;
}

export interface OVMDarwinArm64StartEvent {
    start: string;
    ready: void;
    exit: void;
    error: string;
}

export interface OVMDarwinArm64Info {
    podmanSocketPath: string,
    sshPort: number,
    sshUser: string,
    sshPublicKeyPath: string,
    sshPrivateKeyPath: string,
}

export interface OVMDarwinArm64State {
    state: "Running" | "Stopped";
    canStart: boolean;
    canPause: boolean;
    canResume: boolean;
    canRequestStop: boolean;
    canStop: boolean;
}

// ----- windows

export interface OVMWindowsInfo {
    podmanHost: string;
    podmanPort: number;
}

export interface OVMWindowsOptions {
    name: string;
    resource?: {
        ovm?: string;
        rootfs?: string;
    } | string;
    imageDir: string;
    logDir: string;
    versions: {
        rootfs: string;
        data: string;
    };
    bindPID?: number | string;
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

