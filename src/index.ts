import type { OVMDarwinOptions } from "./type";
import { DarwinOVM } from "./darwin";

export const createDarwinOVM = (options: OVMDarwinOptions): Promise<DarwinOVM> => {
    return DarwinOVM.create(options);
};

export type {
    OVMStatusName,
    OVMEventData,
    OVMDarwinOptions,
    OVMInfo,
    OVMState,
    OVMVzState,
} from "./type";
export type { DarwinOVM };
