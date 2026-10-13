import { Model, ModelProps } from './Model';
import { Address } from './Address';
import { TypeApi } from '../types';
export interface SessionProps {
    access_token?: string;
    expires_in?: number;
    token_type?: string;
}
export declare class Session {
    access_token: string;
    expires_in: number;
    token_type: string;
    constructor(session?: SessionProps);
}
export interface UserProps {
    id?: number;
    name?: string;
    middle_name?: string;
    lastname?: string;
    second_lastname?: string;
    email?: string;
    password?: string;
    login_type?: number;
    social_id?: string;
    photo?: string;
    birthdate?: string;
    phone?: string;
    cellphone?: string;
    country_phone_code?: string;
    city_id?: number;
    dropdown_option_id?: number;
    address?: string;
    address_notes?: string;
    zipcode?: string;
    location?: any;
    push_notifications?: boolean;
    level?: number;
    language_id?: number;
    busy?: boolean;
    available?: boolean;
    map_data?: string;
    enabled?: boolean;
    session?: Session;
    addresses?: Address[];
    [metadata: string]: any;
}
export declare class User extends Model implements ModelProps {
    id: number;
    name: string;
    middle_name: string;
    lastname: string;
    second_lastname: string;
    email: string;
    password: string;
    login_type: number;
    social_id: string;
    photo: string;
    birthdate: string;
    phone: string;
    cellphone: string;
    country_phone_code: string;
    city_id: number;
    dropdown_option_id: number;
    address: string;
    address_notes: string;
    zipcode: string;
    location: any;
    push_notifications: boolean;
    level: number;
    language_id: number;
    busy: boolean;
    available: boolean;
    map_data: string;
    enabled: boolean;
    addresses: Address[];
    session: Session;
    [metadata: string]: any;
    constructor(user: UserProps, api: TypeApi);
    isAdministrator(): boolean;
    isDriver(): boolean;
    isBusinessOwner(): boolean;
    isCustomer(): boolean;
    getAccessToken(): string;
    /**
     * Get indentifier of model
     */
    getId(): number;
}
