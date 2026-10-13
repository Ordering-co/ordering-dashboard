import { Model, ModelProps } from "./Model";
import { TypeApi } from "../types";
export interface location {
    lat?: number;
    lng?: number;
}
export interface DriverLocationsProps {
    location?: location;
    driver_id?: number;
    [metadata: string]: any;
}
export declare class DriverLocations extends Model implements ModelProps {
    location: location;
    driver_id: number;
    [metadata: string]: any;
    constructor(driver: DriverLocationsProps, api: TypeApi);
}
