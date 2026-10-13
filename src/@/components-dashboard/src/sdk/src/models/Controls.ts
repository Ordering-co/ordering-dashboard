import { Model, ModelProps } from "./Model";
import { TypeApi } from "../types";

export interface ControlsProps {
  id?: number;
  [metadata: string]: any
}

export class Controls extends Model implements ModelProps {
  public id: number;
  [metadata: string]: any


  constructor(controls: ControlsProps = {}, api: TypeApi) {
    super(controls, api, ["business"]);
    Object.entries(controls).map(([key, value]) => {
        this[key]  = value
      })
  }
}
