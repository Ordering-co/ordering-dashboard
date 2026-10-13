import { Model, ModelProps } from './Model';
import { TypeApi } from '../types';
export interface CityProps {
    id?: number;
    name?: string;
    country_id?: number;
    administrator_id?: number;
    enabled?: boolean;
    [metadata: string]: any;
}
export declare class City extends Model implements ModelProps {
    id: number;
    key: string;
    value: string;
    [metadata: string]: any;
    constructor(city: CityProps, api: TypeApi);
    /**
     * Get indentifier of model
     */
    getId(): number;
}
