import { ApiResponse } from "./ApiResponse";
import { Ordering } from "./Ordering";
import { RequestOptionsProps } from "../interfaces/RequestOptionsProps";
import { ApiBase, ApiBaseInterface } from "./ApiBase";
import { DriverLocationsProps } from '../models/DriverLocations';
/**
 * Class to driversgroup api control
 */
export declare class ApiDriverLocations extends ApiBase implements ApiBaseInterface {
    private driver_id;
    constructor(ordering: Ordering, userId: number);
    setModelId(id: number): void;
    /**
     * Get an order if orderId is set else get all
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    get(options?: RequestOptionsProps): Promise<ApiResponse>;
    save(changes: DriverLocationsProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    delete(options?: RequestOptionsProps): Promise<ApiResponse>;
}
