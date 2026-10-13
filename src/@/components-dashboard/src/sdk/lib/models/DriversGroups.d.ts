import { Model, ModelProps } from "./Model";
import { TypeApi } from "../types";
export interface DriversGroupsProps {
    administrator_id?: number;
    name?: string;
    drivers?: object;
    enabled?: boolean;
    [metadata: string]: any;
}
export declare class DriversGroups extends Model implements ModelProps {
    administrator_id: number;
    name: string;
    drivers: object;
    enabled: boolean;
    [metadata: string]: any;
    constructor(driver: DriversGroupsProps, api: TypeApi);
}
