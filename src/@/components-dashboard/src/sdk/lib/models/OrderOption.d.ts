import { Model, ModelProps } from './Model';
import { TypeApi } from '../types';
export interface OrderOptionProps {
    id?: number;
    user_id?: number;
    address_id?: number;
    type?: number;
    moment?: string;
    created_at?: string;
    updated_at?: string;
    [metadata: string]: any;
}
export declare class OrderOption extends Model implements ModelProps {
    id: number;
    user_id: number;
    address_id: number;
    type: number;
    moment: string;
    created_at: string;
    updated_at: string;
    [metadata: string]: any;
    constructor(orderOption?: OrderOptionProps, api?: TypeApi);
    /**
     * Get indentifier of model
     */
    getId(): number;
}
