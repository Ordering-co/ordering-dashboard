import { Model, ModelProps } from "./Model";
import { TypeApi } from "../types";
export interface ControlsProps {
    id?: number;
    [metadata: string]: any;
}
export declare class Controls extends Model implements ModelProps {
    id: number;
    [metadata: string]: any;
    constructor(controls: ControlsProps, api: TypeApi);
}
