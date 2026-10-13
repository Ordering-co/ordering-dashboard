import { ApiResponse } from "./ApiResponse";
import { Ordering } from "./Ordering";
import { RequestOptionsProps } from "../interfaces/RequestOptionsProps";
import { ApiBase, ApiBaseInterface } from "./ApiBase";
/**
 * Class to controls api control
 */
export declare class ApiControls extends ApiBase implements ApiBaseInterface {
    private orderId;
    constructor(ordering: Ordering, orderId: number | string);
    setModelId(id: number): void;
    /**
     * Get drivers if orderId is set else get all
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    get(options?: RequestOptionsProps): Promise<ApiResponse>;
    save(changes: any, options?: RequestOptionsProps): Promise<ApiResponse>;
    delete(options?: RequestOptionsProps): Promise<ApiResponse>;
}
