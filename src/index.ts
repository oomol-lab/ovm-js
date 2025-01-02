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
    OVMDarwinInitEventValue,
    OVMDarwinRunEventValue,
    OVMWindowsInitEventValue,
    OVMWindowsRunEventValue,
} from "./type";

export type {
    OVMDarwinOptions,
    OVMDarwinInitEventValueType,
    OVMDarwinRunEventValueType,
    OVMDarwinInitEvent,
    OVMDarwinRunEvent,
    OVMDarwinInfo,
    OVMDarwinState,
    OVMWindowsOptions,
    OVMWindowsInitEventValueType,
    OVMWindowsRunEventValueType,
    OVMWindowsInitEvent,
    OVMWindowsRunEvent,
    OVMWindowsInfo,
} from "./type";
export type { DarwinOVM, WindowsOVM };
