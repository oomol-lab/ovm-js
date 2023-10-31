import type { OVMDarwinOptions } from "./type";
import { DarwinOVM } from "./darwin";

export const createDarwinOVM = (options: OVMDarwinOptions): Promise<DarwinOVM> => {
    return DarwinOVM.create(options);
};

export type {
    OVMDarwinOptions,
    OVMInfo,
    OVMVfkitState,
    OVMVfkitFullState,
} from "./type";
export type { DarwinOVM };
