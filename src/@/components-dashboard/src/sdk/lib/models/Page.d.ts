import { Model, ModelProps } from './Model';
import { TypeApi } from '../types';
export interface PageProps {
    id?: number;
    name?: string;
    slug?: string;
    body?: string;
    enabled?: boolean;
    author_id?: number;
    updated_at?: Date;
    created_at?: Date;
    [metadata: string]: any;
}
export declare class Page extends Model implements ModelProps {
    id: number;
    name: string;
    slug: string;
    body: string;
    enabled: boolean;
    author_id: number;
    updated_at: Date;
    created_at: Date;
    [metadata: string]: any;
    constructor(config: PageProps, api: TypeApi);
    /**
     * Get indentifier of model
     */
    getId(): number;
}
