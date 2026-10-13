import { Model, ModelProps } from './Model';
import { TypeApi } from '../types';
export interface CartProps {
    id?: number;
    uuid?: string;
    status?: number;
    business_id?: number;
    user_id?: number;
    offer_id?: number;
    driver_tip_rate?: number;
    paymethod_id?: number;
    pay_reference?: any;
    paymethod_data?: any;
    delivery_zone_id?: number;
    address_id?: number;
    address?: any;
    order_type?: number;
    moment?: string;
    order_id?: number;
    created_at?: string;
    updated_at?: string;
    [metadata: string]: any;
}
export declare class Cart extends Model implements ModelProps {
    id: number;
    uuid: string;
    status: number;
    business_id: number;
    user_id: number;
    offer_id: number;
    driver_tip_rate: number;
    paymethod_id: number;
    pay_reference: any;
    paymethod_data: any;
    delivery_zone_id: number;
    address_id: number;
    address: any;
    order_type: number;
    moment: string;
    order_id: number;
    created_at: string;
    updated_at: string;
    [metadata: string]: any;
    constructor(cart?: CartProps, api?: TypeApi);
    /**
     * Get indentifier of model
     */
    getId(): number;
}
