import type { OVMDarwinOptions, OVMWindowsOptions } from "./type";
import { DarwinOVM } from "./darwin";
import { WindowsOVM } from "./windows";

export const createDarwinOVM = (options: OVMDarwinOptions): Promise<DarwinOVM> => {
    return DarwinOVM.create(options);
};

export const createWindowsOVM = (options: OVMWindowsOptions): WindowsOVM => {
    return WindowsOVM.create(options);
};

export {
    OVMDarwinAppEventValue,
    OVMDarwinVzState,
    OVMWindowsRunEventValue,
    OVMWindowsPrepareEventValue,
} from "./type";

export type {
    OVMDarwinEventData,
    OVMDarwinOptions,
    OVMDarwinInfo,
    OVMDarwinState,
    OVMWindowsOptions,
    OVMWindowsEventData,
} from "./type";
export type { DarwinOVM, WindowsOVM };
