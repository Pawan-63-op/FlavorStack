// GeoPoint, Address, Permission, TokenPayload, VehicleInfo, WalletTransaction, AuditEntry.
export interface GeoPoint {
  lat: number;
  lng: number;
  distanceTo(point: GeoPoint): number;
  toGeoJson() : object;
}

