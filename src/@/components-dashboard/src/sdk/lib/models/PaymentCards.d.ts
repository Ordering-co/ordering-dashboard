import { Model, ModelProps } from "./Model";
import { TypeApi } from "../types";
export interface PaymentCardsProps {
    brand?: string;
    customer_id?: string;
    default?: boolean;
    id?: string;
    last4?: string;
    publishable?: string;
    [metadata: string]: any;
}
export declare class PaymentCards extends Model implements ModelProps {
    brand?: string;
    customer_id?: string;
    default?: boolean;
    id?: string;
    last4?: string;
    publishable?: string;
    [metadata: string]: any;
    constructor(cards: PaymentCardsProps, api: TypeApi);
}
