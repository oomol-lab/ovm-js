import type { OVMDarwinOptions } from "./type";
import { DarwinOVM } from "./darwin";

export const createDarwinOVM = (options: OVMDarwinOptions): Promise<DarwinOVM> => {
    return DarwinOVM.create(options);
};

export {
    OVMStatusName,
    OVMVzState,
} from "./type";

export type {
    OVMEventData,
    OVMDarwinOptions,
    OVMInfo,
    OVMState,
} from "./type";
export type { DarwinOVM };
