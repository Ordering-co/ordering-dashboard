import { ApiResponse } from "./ApiResponse";
import { Ordering } from "./Ordering";
import { RequestOptionsProps } from "../interfaces/RequestOptionsProps";
import { ApiBase, ApiBaseInterface } from "./ApiBase";
import { DriverLocations, DriverLocationsProps } from '../models/DriverLocations';

/**
 * Class to driversgroup api control
 */
export class ApiDriverLocations extends ApiBase implements ApiBaseInterface {
  private driver_id: number;

  constructor (ordering: Ordering, userId: number) {
    super(ordering)
    this.ordering = ordering
    this.driver_id = userId
  }


  setModelId(id: number) {
    this.driver_id = id;
  }

  /**
   * Get an order if orderId is set else get all
   * @param {RequestOptionsProps} options Params, headers and other options
   */
  async get(options: RequestOptionsProps = {}) {
    if (!this.driver_id) {
        throw new Error('You must provide the `dfriver_id` param. Example ordering.users(driver_id).driverLocations().get()')
      }
    if (this.driver_id && this.conditions) {
      throw new Error(
        "The `where` function is not compatible with users(driver_id). Example ordering.users(driver_id).where(contitions).driverLocations().get()"
      );
    }
    const url = "/users" + (this.driver_id ? `/${this.driver_id}` : "" + "/locations");
    const response: ApiResponse = await this.makeRequest("GET", url, undefined, DriverLocations, options);

    return response;
  }

  async save(changes: DriverLocationsProps, options?: RequestOptionsProps) {
    if (!this.driver_id) {
        throw new Error('You must provide the `dfriver_id` param. Example ordering.users(driver_id).driverLocations().save(changes)')
    }

    if (!changes.location.lat || !changes.location.lng) {
        throw new Error('You must provide the `location` param. Example ordering.users(driver_id).driverLocations().save({ lat: 10, lng: 10})')
    }

    const url = "/users" + (this.driver_id ? `/${this.driver_id}/locations` : "");
    
    const response: ApiResponse = await this.makeRequest("POST", url, changes, DriverLocations, options)

    return response;
  }

  delete(options?: RequestOptionsProps): Promise<ApiResponse> {
    throw new Error("Method not implemented.");
  }
} 