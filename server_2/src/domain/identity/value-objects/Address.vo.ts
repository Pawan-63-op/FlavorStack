import { GeoPoint } from "./GeoPoint.vo";
export interface Address{
    id:string;
    label:string;
    street:string;
    city:string;
    state:string;
    pinCode:string;
    coordinates:GeoPoint;
    isDefault:boolean;
    toString():string;
}