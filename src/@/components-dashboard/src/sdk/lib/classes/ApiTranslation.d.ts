import { ApiBase, ApiBaseInterface } from './ApiBase';
import { Ordering } from './Ordering';
import { TranslationProps } from '../models/Translation';
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps';
import { ApiResponse } from './ApiResponse';
export declare class ApiTranslation extends ApiBase implements ApiBaseInterface {
    translationId: number;
    constructor(ordering: Ordering, translationId: number);
    /**
     * Replace current modelId
     * @param id ID to replace current api modelId
     */
    setModelId(id: number): void;
    /**
     * Get a translation if translationId is set else get all
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    get(options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Update a translation if translationId is set else create translation
     * @param {TranslationProps} translation Attributes to create or update translation
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    save(translation: TranslationProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Delete a translation by translationId
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    delete(options?: RequestOptionsProps): Promise<ApiResponse>;
}
