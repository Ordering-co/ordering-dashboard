import { Model, ModelProps } from './Model';
import { TypeApi } from '../types';
export interface ConfigProps {
    id?: number;
    key?: string;
    value?: string;
    [metadata: string]: any;
}
export declare class Config extends Model implements ModelProps {
    id: number;
    key: string;
    value: string;
    [metadata: string]: any;
    constructor(config: ConfigProps, api: TypeApi);
    /**
     * Get indentifier of model
     */
    getId(): number;
}
