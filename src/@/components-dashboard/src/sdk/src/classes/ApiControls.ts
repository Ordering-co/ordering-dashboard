import { ApiResponse } from "./ApiResponse";
import { Ordering } from "./Ordering";
import { RequestOptionsProps } from "../interfaces/RequestOptionsProps";
import { ApiBase, ApiBaseInterface } from "./ApiBase";
import { Controls } from "../models/Controls";

/**
 * Class to controls api control
 */
export class ApiControls extends ApiBase implements ApiBaseInterface {
  private orderId: number | string | null;

  constructor(ordering: Ordering, orderId: number | string | null) {
    super(ordering);
    this.orderId = orderId
  }

  setModelId(id: number) {
    this.orderId = id;
  }

  /**
   * Get drivers if orderId is set else get all
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async get(options: RequestOptionsProps = {}) {
    if (this.orderId && this.conditions) {
      throw new Error(
        "The `where` function is not compatible with controls(orderId). Example ordering.orders().where(contitions).get()"
      );
    }
    const url = "/controls/orders" + (this.orderId ? `/${this.orderId}` : "");
    const response: ApiResponse = await this.makeRequest("GET", url, undefined, Controls, options);

    return response;
  }

  save(changes: any, options?: RequestOptionsProps): Promise<ApiResponse> {
    throw new Error("Method not implemented.");
  }
  delete(options?: RequestOptionsProps): Promise<ApiResponse> {
    throw new Error("Method not implemented.");
  }
}
