import { Model, ModelProps } from './Model';
import { TypeApi } from '../types';
export interface CountryProps {
    id?: number;
    name?: string;
    enabled?: boolean;
    [metadata: string]: any;
}
export declare class Country extends Model implements ModelProps {
    id: number;
    key: string;
    value: string;
    [metadata: string]: any;
    constructor(country: CountryProps, api: TypeApi);
    /**
     * Get indentifier of model
     */
    getId(): number;
}
