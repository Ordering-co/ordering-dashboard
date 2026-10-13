import { AddressProps } from '../models/Address';
import { ApiResponse } from './ApiResponse';
import { Ordering } from './Ordering';
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps';
import { ApiBase, ApiBaseInterface } from './ApiBase';
/**
 * Class to Address api control
 */
export declare class ApiAddress extends ApiBase implements ApiBaseInterface {
    userId: number;
    addressId: number;
    constructor(ordering: Ordering, userId: number, addressId?: number);
    /**
     * Replace current modelId
     * @param id ID to replace current api modelId
     */
    setModelId(id: number): void;
    /**
     * Get an address if addressId is set else get all
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    get(options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Update an address if addressId is set else create address
     * @param {AddressProps} address Attributes to create or update address
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    save(address: AddressProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Delete an address by addressId
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    delete(options?: RequestOptionsProps): Promise<ApiResponse>;
}
