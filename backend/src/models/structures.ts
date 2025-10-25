
// Possible vehicle statuses
export type VehicleStatus = 'Available' | 'InUse' | 'Maintenance';

// Vehicle data structure
export interface Vehicle {
    id: string;             
    licensePlate: string;   
    model: string;
    status: VehicleStatus;  
    createdAt: string;      // (ISO format)
}

export type ServiceErrorCode =
  | 'LICENSE_PLATE_REQUIRED'
  | 'MODEL_REQUIRED'
  | 'INVALID_LICENSE_PLATE'
  | 'DUPLICATE_LICENSE_PLATE'
  | 'VEHICLE_NOT_FOUND'
  | 'INVALID_STATUS'
  | 'ILLEGAL_STATUS_TRANSITION'
  | 'MAINTENANCE_CAP_EXCEEDED'
  | 'NOT_ALLOWED_STATUS_FOR_DELETE'
  | 'ADMIN_APPROVAL_REQUIRED';

export type ServiceError = {
  code: ServiceErrorCode;
  message: string;
};

export type Ok<T> = { ok: true; data: T };
export type Err = { ok: false; error: ServiceError };
export type Result<T> = Ok<T> | Err;

