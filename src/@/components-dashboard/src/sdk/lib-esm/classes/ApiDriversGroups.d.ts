import { ApiResponse } from "./ApiResponse";
import { Ordering } from "./Ordering";
import { RequestOptionsProps } from "../interfaces/RequestOptionsProps";
import { ApiBase, ApiBaseInterface } from "./ApiBase";
/**
 * Class to driversgroup api control
 */
export declare class ApiDriversGroups extends ApiBase implements ApiBaseInterface {
    private driversGroupsId;
    constructor(ordering: Ordering);
    setModelId(id: number): void;
    /**
     * Get an order if orderId is set else get all
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    get(options?: RequestOptionsProps): Promise<ApiResponse>;
    save(changes: any, options?: RequestOptionsProps): Promise<ApiResponse>;
    delete(options?: RequestOptionsProps): Promise<ApiResponse>;
}
