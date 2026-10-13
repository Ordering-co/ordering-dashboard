import { Model, ModelProps } from './Model';
import { TypeApi } from '../types';
export interface LanguageProps {
    id?: number;
    name?: string;
    code?: string;
    default?: boolean;
    enabled?: boolean;
    rtl?: boolean;
    [metadata: string]: any;
}
export declare class Language extends Model implements ModelProps {
    id: number;
    name: string;
    code: string;
    default: boolean;
    enabled: boolean;
    rtl: boolean;
    [metadata: string]: any;
    constructor(language: LanguageProps, api: TypeApi);
    /**
     * Get indentifier of model
     */
    getId(): number;
}
