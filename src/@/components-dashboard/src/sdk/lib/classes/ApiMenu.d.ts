import { ApiResponse } from './ApiResponse';
import { Ordering } from './Ordering';
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps';
import { ApiBase, ApiBaseInterface } from './ApiBase';
import { MenuProps } from '../models/Menu';
/**
 * Class to menu api control
 */
export declare class ApiMenu extends ApiBase implements ApiBaseInterface {
    businessId: number;
    menuId: number;
    constructor(ordering: Ordering, businessId: number, menuId?: number);
    /**
     * Replace current modelId
     * @param id ID to replace current api modelId
     */
    setModelId(id: number): void;
    /**
     * Get a menu if menuId is set else get all
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    get(options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Update a menu if menuId is set else create menu
     * @param {MenuProps} menu Attributes to create or update menu
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    save(menu: MenuProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Delete a menu by menuId
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    delete(options?: RequestOptionsProps): Promise<ApiResponse>;
}
