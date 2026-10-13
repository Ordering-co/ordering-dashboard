import { LanguageProps } from '../models/Language';
import { ApiResponse } from './ApiResponse';
import { Ordering } from './Ordering';
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps';
import { ApiBase, ApiBaseInterface } from './ApiBase';
export declare class ApiLanguage extends ApiBase implements ApiBaseInterface {
    private languageId;
    constructor(ordering: Ordering, languageId: number);
    /**
     * Replace current modelId
     * @param id ID to replace current api modelId
     */
    setModelId(id: number): void;
    /**
     * Get a language if languageId is set else get all
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    get(options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Update a language if languageId is set else create language
     * @param {LanguageProps} language Attributes to create or update language
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    save(language: LanguageProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Delete a language by languageId
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    delete(options?: RequestOptionsProps): Promise<ApiResponse>;
}
