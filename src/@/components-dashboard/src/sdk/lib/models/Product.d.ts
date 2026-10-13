import { Model, ModelProps } from './Model';
import { TypeApi } from '../types';
export interface ProductProps {
    id?: number;
    name?: string;
    price?: number;
    description?: string;
    images?: string;
    sku?: string;
    category_id?: number;
    inventoried?: boolean;
    quantity?: number;
    featured?: boolean;
    enabled?: boolean;
    upselling?: boolean;
    in_offer?: boolean;
    offer_price?: number;
    rank?: number;
    [metadata: string]: any;
}
export declare class Product extends Model implements ModelProps {
    id: number;
    name: string;
    price: number;
    description: string;
    images: string;
    sku: string;
    category_id: number;
    inventoried: boolean;
    quantity: number;
    featured: boolean;
    enabled: boolean;
    upselling: boolean;
    in_offer: boolean;
    offer_price: number;
    rank: number;
    [metadata: string]: any;
    constructor(product?: ProductProps, api?: TypeApi);
    /**
     * Get indentifier of model
     */
    getId(): number;
}
