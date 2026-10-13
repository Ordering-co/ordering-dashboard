import { Model, ModelProps } from './Model';
import { TypeApi } from '../types';
export interface ValidationFieldProps {
    id?: number;
    name?: string;
    code?: string;
    validate?: string;
    type?: string;
    required?: boolean;
    enabled?: boolean;
    [metadata: string]: any;
}
export declare class ValidationField extends Model implements ModelProps {
    id: number;
    name: string;
    code: string;
    validate: string;
    type: string;
    required: boolean;
    enabled: boolean;
    [metadata: string]: any;
    constructor(field: ValidationFieldProps, api: TypeApi);
    /**
     * Get indentifier of model
     */
    getId(): number;
}
