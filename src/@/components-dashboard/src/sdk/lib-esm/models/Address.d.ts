import { Model, ModelProps } from './Model';
import { TypeApi } from '../types';
export interface AddressProps {
    id?: number;
    user_id?: number;
    name?: string;
    middle_name?: string;
    lastname?: string;
    second_lastname?: string;
    address?: string;
    address_notes?: string;
    internal_number?: string;
    phone?: string;
    cellphone?: string;
    zipcode?: string;
    location?: object;
    tag?: string;
    map_data?: object;
    default?: boolean;
    [metadata: string]: any;
}
export declare class Address extends Model implements ModelProps {
    id: number;
    user_id: number;
    name: string;
    middle_name: string;
    lastname: string;
    second_lastname: string;
    address: string;
    address_notes: string;
    internal_number: string;
    phone: string;
    cellphone: string;
    zipcode: string;
    location: object;
    tag: string;
    map_data: object;
    default: boolean;
    [metadata: string]: any;
    constructor(address: AddressProps, api: TypeApi);
    /**
     * Get indentifier of model
     */
    getId(): number;
}
