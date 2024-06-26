import type { OVMDarwinOptions } from "./type";
import { DarwinOVM } from "./darwin";

export const createDarwinOVM = (options: OVMDarwinOptions): Promise<DarwinOVM> => {
    return DarwinOVM.create(options);
};

export {
    OVMDarwinStatusName,
    OVMDarwinVzState,
} from "./type";

export type {
    OVMDarwinEventData,
    OVMDarwinOptions,
    OVMDarwinInfo,
    OVMDarwinState,
} from "./type";
export type { DarwinOVM };
