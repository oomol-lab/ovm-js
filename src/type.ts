// ----- darwin
export interface OVMDarwinOptions {
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

export interface OVMDarwinInitEvent {
    decompress: "running" | "success";
    writeConfig: "running" | "success";
    exit: void;
    error: string;
}

export interface OVMDarwinStartEvent {
    start: string;
    ready: void;
    exit: void;
    error: string;
}

export interface OVMDarwinInfo {
    podmanSocketPath: string,
    sshPort: number,
    sshUser: string,
    sshPublicKeyPath: string,
    sshPrivateKeyPath: string,
}

export interface OVMDarwinState {
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

