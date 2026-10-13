import { ApiResponse } from './ApiResponse';
import { Ordering } from './Ordering';
import { RequestOptionsProps } from '../interfaces/RequestOptionsProps';
interface DataGetCode {
    email?: string;
    code?: string;
}
export declare class ApiSystem {
    private ordering;
    constructor(ordering: Ordering);
    auth(data: DataGetCode, options?: RequestOptionsProps): Promise<ApiResponse>;
    getCode(data: DataGetCode, options?: RequestOptionsProps): Promise<ApiResponse>;
}
export {};
