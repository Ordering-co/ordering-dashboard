import { Model, ModelProps } from './Model';
import { TypeApi } from '../types';
import { Product } from './Product';
export interface MenuProps {
    id?: number;
    business_id?: number;
    name?: string;
    comment?: string;
    schedule?: string;
    pickup?: boolean;
    delivery?: boolean;
    enabled?: boolean;
    eatin?: boolean;
    products?: Product[];
    [metadata: string]: any;
}
export declare class Menu extends Model implements ModelProps {
    id: number;
    business_id: number;
    name: string;
    comment: string;
    schedule: string;
    pickup: boolean;
    delivery: boolean;
    enabled: boolean;
    eatin: boolean;
    products: Product[];
    [metadata: string]: any;
    constructor(menu?: MenuProps, api?: TypeApi);
    /**
     * Get indentifier of model
     */
    getId(): number;
}
