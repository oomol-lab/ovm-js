import type { OVMDarwinArm64Options, OVMDarwinOptions, OVMWindowsOptions } from "./type";
import { DarwinOVM } from "./darwin_x64";
import { WindowsOVM } from "./windows";
import { DarwinOVMArm64 } from "./darwin_arm64";

export const createDarwinOVM = (options: OVMDarwinOptions): Promise<DarwinOVM> => {
    return DarwinOVM.create(options);
};

export const createDarwinArm64OVM = (options: OVMDarwinArm64Options): Promise<DarwinOVMArm64> => {
    return DarwinOVMArm64.create(options);
};

export const createWindowsOVM = (options: OVMWindowsOptions): WindowsOVM => {
    return WindowsOVM.create(options);
};

export { OVMDarwinAppEventValue, OVMDarwinVzState, OVMWindowsRunEventValue, OVMWindowsPrepareEventValue } from "./type";

export type {
    OVMDarwinEventData,
    OVMDarwinOptions,
    OVMDarwinInfo,
    OVMDarwinState,
    OVMDarwinArm64Options,
    OVMDarwinArm64InitEvent,
    OVMDarwinArm64StartEvent,
    OVMDarwinArm64Info,
    OVMDarwinArm64State,
    OVMWindowsOptions,
    OVMWindowsEventData,
    OVMWindowsInfo,
} from "./type";
export type { DarwinOVM, DarwinOVMArm64, WindowsOVM };
