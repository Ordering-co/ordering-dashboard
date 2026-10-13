import { ApiResponse } from './ApiResponse';
import { Ordering } from './Ordering';
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps';
import { ApiBase, ApiBaseInterface } from './ApiBase';
import { OrderMessageProps } from '../models/OrderMessage';
/**
 * Class to order message api control
 */
export declare class ApiOrderMessage extends ApiBase implements ApiBaseInterface {
    orderId: number;
    messageId: number;
    constructor(ordering: Ordering, orderId: number, messageId?: number);
    /**
     * Replace current modelId
     * @param id ID to replace current api modelId
     */
    setModelId(id: number): void;
    /**
     * Get a order message if messageId is set else get all
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    get(options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Update a order message if messageId is set else create order message
     * @param {OrderMessageProps} order message Attributes to create or update order message
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    save(orderMessage: OrderMessageProps, options?: RequestOptionsProps): Promise<ApiResponse>;
    /**
     * Delete a order message by messageId
     * @param {RequestOptionsProps} options Params, headers and other options
     */
    delete(options?: RequestOptionsProps): Promise<ApiResponse>;
}
