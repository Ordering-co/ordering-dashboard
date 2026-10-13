import { Model, ModelProps } from './Model';
import { TypeApi } from '../types';
export interface TranslationProps {
    id?: number;
    key?: string;
    text?: string;
    [metadata: string]: any;
}
export declare class Translation extends Model implements ModelProps {
    id: number;
    key: string;
    text: string;
    [metadata: string]: any;
    constructor(translation: TranslationProps, api: TypeApi);
    /**
     * Get indentifier of model
     */
    getId(): number;
}
