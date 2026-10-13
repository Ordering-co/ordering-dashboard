import { TypeApi } from '../types';
export interface ModelProps {
    getId(): number | string;
}
export declare class Model {
    private original;
    private api;
    private hidden;
    constructor(original: any, api: TypeApi, hidden?: string[]);
    setApi(api: TypeApi): void;
    getId(): number;
    save(): Promise<any>;
}
