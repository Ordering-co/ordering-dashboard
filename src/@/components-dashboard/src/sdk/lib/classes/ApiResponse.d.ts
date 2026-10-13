import { RequestOptionsProps } from '../interfaces/RequestOptionsProps';
import { TypeApi } from '../types';
export declare class ApiResponse {
    private response;
    private options;
    private api;
    constructor(response: any, options?: RequestOptionsProps, api?: TypeApi);
    get content(): any;
    get status(): number;
}
