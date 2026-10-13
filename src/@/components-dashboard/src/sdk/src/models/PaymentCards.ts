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

export class PaymentCards extends Model implements ModelProps {
  public brand?: string;
  public customer_id?: string;
  public default?: boolean;
  public id?: string;
  public last4?: string;
  public publishable?: string;
  [metadata: string]: any;

  constructor(cards: PaymentCardsProps = {}, api: TypeApi) {
    super(cards, api, []);
    Object.entries(cards).map(([key, value]) => {
      this[key] = value;
    });
  }
}