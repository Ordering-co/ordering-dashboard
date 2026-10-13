import { ApiResponse } from "./ApiResponse";
import { Ordering } from "./Ordering";
import { RequestOptionsProps } from "../interfaces/RequestOptionsProps";
import { ApiBase, ApiBaseInterface } from "./ApiBase";
import { DriversGroups, DriversGroupsProps } from "../models/DriversGroups";

/**
 * Class to driversgroup api control
 */
export class ApiDriversGroups extends ApiBase implements ApiBaseInterface {
  private driversGroupsId: number | string;

  constructor(ordering: Ordering) {
    super(ordering);
  }

  setModelId(id: number) {
    this.driversGroupsId = id;
  }

  /**
   * Get an order if orderId is set else get all
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async get(options: RequestOptionsProps = {}) {
    if (this.driversGroupsId && this.conditions) {
      throw new Error(
        "The `where` function is not compatible with orders(driversGroupsId). Example ordering.orders().where(contitions).get()"
      );
    }
    const url = "/drivergroups" + (this.driversGroupsId ? `/${this.driversGroupsId}` : "");
    const response: ApiResponse = await this.makeRequest("GET", url, undefined, DriversGroups, options);

    return response;
  }

  save(changes: any, options?: RequestOptionsProps): Promise<ApiResponse> {
    throw new Error("Method not implemented.");
  }
  delete(options?: RequestOptionsProps): Promise<ApiResponse> {
    throw new Error("Method not implemented.");
  }
}
