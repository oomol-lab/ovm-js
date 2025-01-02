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

export type OVMDarwinInitEventValueType = keyof typeof OVMDarwinInitEventValue;

export enum OVMDarwinInitEventValue {
    Error = "Error",
    Exit = "Exit",
}

export type OVMDarwinRunEventValueType = keyof typeof OVMDarwinRunEventValue;

export enum OVMDarwinRunEventValue {
    Ready = "Ready",
    Error = "Error",
    Exit = "Exit",
}

export type OVMDarwinInitEvent = {
    [k in OVMDarwinInitEventValueType]: {
        value?: string;
    }
}

export type OVMDarwinRunEvent = {
    [k in OVMDarwinRunEventValueType]: {
        value?: string;
    }
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

export type OVMWindowsInitEventValueType = keyof typeof OVMWindowsInitEventValue;

export enum OVMWindowsInitEventValue {
    SystemNotSupport = "SystemNotSupport",

    NotSupportVirtualization = "NotSupportVirtualization",
    NeedEnableFeature = "NeedEnableFeature",
    EnableFeaturing = "EnableFeaturing",
    EnableFeatureFailed = "EnableFeatureFailed",
    EnableFeatureSuccess = "EnableFeatureSuccess",
    NeedReboot = "NeedReboot",

    NeedUpdateWSL = "NeedUpdateWSL",
    UpdatingWSL = "UpdatingWSL",
    UpdateWSLFailed = "UpdateWSLFailed",
    UpdateWSLSuccess = "UpdateWSLSuccess",
    Exit = "Exit",
    Error = "Error",
}

export type OVMWindowsRunEventValueType = keyof typeof OVMWindowsRunEventValue;

export enum OVMWindowsRunEventValue {
    Ready = "Ready",
    Exit = "Exit",
    Error = "Error",
}

export type OVMWindowsInitEvent = {
    [k in OVMWindowsInitEventValueType]: {
        value?: string;
    }
}

export type OVMWindowsRunEvent = {
    [k in OVMWindowsRunEventValueType]: {
        value?: string;
    }
}

