export type VehicleStatus = 'Available' | 'InUse' | 'Maintenance';

export type Vehicle = {
  id: string;
  licensePlate: string;
  model: string;
  status: VehicleStatus;
  createdAt: string;
};

export type ServiceErrorCode =
  | 'LICENSE_PLATE_REQUIRED'
  | 'MODEL_REQUIRED'
  | 'INVALID_LICENSE_PLATE'
  | 'DUPLICATE_LICENSE_PLATE'
  | 'VEHICLE_NOT_FOUND'
  | 'INVALID_STATUS'
  | 'ILLEGAL_STATUS_TRANSITION'
  | 'MAINTENANCE_CAP_EXCEEDED'
  | 'NOT_ALLOWED_STATUS_FOR_DELETE';

export type ServiceError = {
  code: ServiceErrorCode;
  message: string;
};

export type Result<T> = { ok: true; data: T } | { ok: false; error: ServiceError };
