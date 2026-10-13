import { Model, ModelProps } from './Model';
import { TypeApi } from '../types';
import { Product } from './Product';
export interface CategoryProps {
    id?: number;
    business_id?: string;
    name?: string;
    image?: string;
    rank?: string;
    enabled?: string;
    products?: Product[];
    [metadata: string]: any;
}
export declare class Category extends Model implements ModelProps {
    id: number;
    business_id: string;
    name: string;
    image: string;
    rank: string;
    enabled: string;
    products: Product[];
    [metadata: string]: any;
    constructor(category?: CategoryProps, api?: TypeApi);
    /**
     * Get indentifier of model
     */
    getId(): number;
}
