import type { OVMDarwinOptions, OVMWindowsOptions } from "./type";
import { DarwinOVM } from "./darwin";
import { WindowsOVM } from "./windows";

export const createDarwinOVM = (options: OVMDarwinOptions): Promise<DarwinOVM> => {
    return DarwinOVM.create(options);
};

export const createWindowsOVM = (options: OVMWindowsOptions): WindowsOVM => {
    return WindowsOVM.create(options);
};

export { OVMWindowsRunEventValue, OVMWindowsPrepareEventValue } from "./type";

export type {
    OVMDarwinOptions,
    OVMDarwinInitEvent,
    OVMDarwinStartEvent,
    OVMDarwinInfo,
    OVMDarwinState,
    OVMWindowsOptions,
    OVMWindowsEventData,
    OVMWindowsInfo,
} from "./type";
export type { DarwinOVM, WindowsOVM };
