import { Model, ModelProps } from './Model';
import { TypeApi } from '../types';
export interface OrderMessageProps {
    id?: number;
    order_id?: number;
    author_id?: number;
    type?: number;
    change?: any;
    source?: string;
    comment?: string;
    driver_id?: number;
    ip?: string;
    can_see?: string;
    location?: any;
    user_agent?: string;
    app_id?: string;
    created_at?: string;
    updated_at?: string;
    [metadata: string]: any;
}
export declare class OrderMessage extends Model implements ModelProps {
    id: number;
    order_id: number;
    author_id: number;
    type: number;
    change: any;
    source: string;
    comment: string;
    driver_id: number;
    ip: string;
    can_see: string;
    location: any;
    user_agent: string;
    app_id: string;
    created_at: string;
    updated_at: string;
    [metadata: string]: any;
    constructor(orderMessage?: OrderMessageProps, api?: TypeApi);
    /**
     * Get indentifier of model
     */
    getId(): number;
}
