// frontend/src/errorMessages.ts
import type { ServiceErrorCode } from './types';

// Maps backend error codes to user-friendly messages
export function errorMessage(code: ServiceErrorCode): string {
  switch (code) {
    case 'LICENSE_PLATE_REQUIRED': 
      return 'License plate is required.';
    case 'MODEL_REQUIRED': 
      return 'Model is required.';
    case 'INVALID_LICENSE_PLATE': 
      return 'Invalid plate: must be 5–10 alphanumeric characters.';
    case 'DUPLICATE_LICENSE_PLATE': 
      return 'This license plate already exists.';
    case 'VEHICLE_NOT_FOUND': 
      return 'Vehicle not found.';
    case 'INVALID_STATUS': 
      return 'Invalid vehicle status.';
    case 'ILLEGAL_STATUS_TRANSITION': 
      return 'Illegal status transition: Maintenance → only Available allowed.';
    case 'MAINTENANCE_CAP_EXCEEDED': 
      return 'Maintenance cap (5%) exceeded.';
    case 'NOT_ALLOWED_STATUS_FOR_DELETE': 
      return 'Only Available vehicles can be deleted.';
    case 'ADMIN_APPROVAL_REQUIRED':
      return 'Admin approval required. Please enter the correct admin password.';
    default: 
      return 'Unknown error.';
  }
}
