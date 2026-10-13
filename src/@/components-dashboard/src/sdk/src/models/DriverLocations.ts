import { Model, ModelProps } from "./Model";
import { TypeApi } from "../types";

export interface location {
  lat?: number;
  lng?: number;
}

export interface DriverLocationsProps {
  location?: location;
  driver_id?: number;
  [metadata: string]: any;
}

export class DriverLocations extends Model implements ModelProps {
  public location: location;
  public  driver_id: number;
  [metadata: string]: any;

  constructor(driver: DriverLocationsProps = {}, api: TypeApi) {
    super(driver, api, ["driver"]);
    Object.entries(driver).map(([key, value]) => {
      this[key] = value;
    });
  }
}
