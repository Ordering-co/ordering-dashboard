import { Model, ModelProps } from "./Model";
import { TypeApi } from "../types";

export interface DriversGroupsProps {
  administrator_id?: number;
  name?: string;
  drivers?: object;
  enabled?: boolean;
  [metadata: string]: any
}

export class DriversGroups extends Model implements ModelProps {
  public administrator_id: number;
  public name: string;
  public drivers: object;
  public enabled: boolean;
  [metadata: string]: any


  constructor(driver: DriversGroupsProps = {}, api: TypeApi) {
    super(driver, api, ["business"]);
    Object.entries(driver).map(([key, value]) => {
        this[key]  = value
      })
  }
}
