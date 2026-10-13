import { ApiResponse } from './ApiResponse';
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps';
import { Ordering } from './Ordering';
export interface ApiBaseInterface {
    setModelId(id: number): void;
    get(options?: RequestOptionsProps): Promise<ApiResponse>;
    save(changes: any, options?: RequestOptionsProps): Promise<ApiResponse>;
    delete(options?: RequestOptionsProps): Promise<ApiResponse>;
}
interface SubconditionInterface {
    condition: string;
    value: string | boolean | number | number[] | string[];
}
export interface ConditionInterface {
    attribute: string;
    value: string | boolean | number | number[] | string[] | SubconditionInterface;
}
export declare class ApiBase {
    ordering: Ordering;
    attributes: string[];
    conditions: any;
    query: any;
    mode: string;
    constructor(ordering: Ordering);
    /**
     * Select the attributes to get from Ordering API
     * @param attributes List of attributes
     */
    select(attributes: string[]): this;
    /**
     * Conditions to get from Ordering API
     * @param conditions List of conditions
     */
    where(conditions: any): this;
    /**
     * Change request mode
     * @param mode Request mode
     */
    setMode(mode: string): this;
    /**
     * Change request mode to dashboard
     */
    asDashboard(): this;
    /**
     * Change request mode to dashboard
     */
    asDictionary(): this;
    /**
     * Change request mode to dashboard
     */
    parameters(parameters: any): this;
    /**
     * Make request by options
     * @param method HTTP method
     */
    makeRequest(method: string, url: string, data: any, model: any, options: RequestOptionsProps): Promise<ApiResponse>;
}
export {};
