import { ApiResponse } from './ApiResponse';
import { Ordering } from './Ordering';
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps';
import { ConfigProps } from '../models/Config';
import { ApiBase, ApiBaseInterface } from './ApiBase';
/**
 * Class to configs api control
 */
export declare class ApiConfig extends ApiBase implements ApiBaseInterface {
    private configId;
    constructor(ordering: Ordering, configId: number);
    /**
     * Replace current modelId
     * @param id ID to replace current api modelId
     */
    setModelId(id: number): void;
    /**
     * Get a config if configId is set else get all
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    get(options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Update a config if configId is set else create config
     * @param {ConfigProps} config Attributes to create or update config
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    save(config: ConfigProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Delete a config by configId
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    delete(options?: RequestOptionsProps): Promise<ApiResponse>;
}
