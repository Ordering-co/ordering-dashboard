import { ApiResponse } from './ApiResponse';
import { Ordering } from './Ordering';
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps';
import { ApiBase, ApiBaseInterface } from './ApiBase';
import { CountryProps } from '../models/Country';
import { ApiCity } from './ApiCity';
/**
 * Class to countries api control
 */
export declare class ApiCountry extends ApiBase implements ApiBaseInterface {
    private countryId;
    constructor(ordering: Ordering, countryId: number);
    /**
     * Replace current modelId
     * @param id ID to replace current api modelId
     */
    setModelId(id: number): void;
    /**
     * Get a country if countryId is set else get all
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    get(options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Update a country if countryId is set else create country
     * @param {CountryProps} country Attributes to create or update country
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    save(country: CountryProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Delete a country by countryId
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    delete(options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Return cities api
     * @param {number} cityId City id is optional
     */
    cities(cityId: number): ApiCity;
}
