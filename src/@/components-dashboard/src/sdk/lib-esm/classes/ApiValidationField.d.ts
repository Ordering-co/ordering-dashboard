import { ApiResponse } from './ApiResponse';
import { Ordering } from './Ordering';
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps';
import { ValidationFieldProps } from '../models/ValidationField';
import { ApiBase, ApiBaseInterface } from './ApiBase';
export declare class ApiValidationField extends ApiBase implements ApiBaseInterface {
    fieldId: number;
    constructor(ordering: Ordering, fieldId: number);
    /**
     * Replace current modelId
     * @param id ID to replace current api modelId
     */
    setModelId(id: number): void;
    /**
     * Get a validation field if fieldId is set else get all
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    get(options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Update a validation field if fieldId is set else create validation fiel
     * @param {ValidationFieldProps} validationField Attributes to create or update validation field
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    save(validationField: ValidationFieldProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Delete a validation field by fieldId
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    delete(options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Get only fields for custom
     */
    toType(type: string): this;
    /**
     * Get only fields for checkout
     */
    toCheckout(): this;
    /**
     * Get only fields for address
     */
    toAddress(): this;
}
