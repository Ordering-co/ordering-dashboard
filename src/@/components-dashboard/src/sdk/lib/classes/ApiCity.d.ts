import { ApiResponse } from './ApiResponse';
import { Ordering } from './Ordering';
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps';
import { ApiBase, ApiBaseInterface } from './ApiBase';
import { CityProps } from '../models/City';
/**
 * Class to city api control
 */
export declare class ApiCity extends ApiBase implements ApiBaseInterface {
    countryId: number;
    cityId: number;
    constructor(ordering: Ordering, countryId: number, cityId?: number);
    /**
     * Replace current modelId
     * @param id ID to replace current api modelId
     */
    setModelId(id: number): void;
    /**
     * Get a city if cityId is set else get all
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    get(options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Update a city if cityId is set else create city
     * @param {CityProps} city Attributes to create or update city
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    save(city: CityProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Delete a city by cityId
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    delete(options?: RequestOptionsProps): Promise<ApiResponse>;
}
