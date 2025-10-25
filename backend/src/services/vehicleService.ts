import fs from 'fs';
import path from 'path';
import { VehicleStatus, Vehicle } from '../models/structures';
import { Result, Ok, Err, ServiceErrorCode } from '../models/structures';

// Load existing vehicles from JSON file
const dataPath = process.env.DATA_PATH
  ? path.resolve(process.env.DATA_PATH)
  : path.join(__dirname, '..', 'data', 'vehicles.json');

const vehicles: Vehicle[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

// Helpers:
// Normalize license plate for reliable comparison
function normalizePlate(p: string): string {
  return (p || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ''); // remove non-alphanumerics (spaces, dashes)
}

// Validate normalized plate format
function isValidPlateNorm(norm: string): boolean {
  return /^[A-Z0-9]{5,10}$/.test(norm);
} 

// Result constructors, for uniform error handling
function err(code: ServiceErrorCode, message: string): Err {
  return { ok: false, error: { code, message } };
}

// Persist vehicles array to JSON file
function persist(): void {
  fs.writeFileSync(dataPath, JSON.stringify(vehicles, null, 2));
}


// Service functions:
// CREATE a new vehicle
export function createVehicle(licensePlate: string, model: string): Result<Vehicle> { 
    if (!licensePlate) return err('LICENSE_PLATE_REQUIRED', 'licensePlate is required');
    if (!model) return err('MODEL_REQUIRED', 'model is required');

    // Normalize before validating and saving
    const normalizedPlate = normalizePlate(licensePlate);
    if (!isValidPlateNorm(normalizedPlate)) { // invalid format
        return err('INVALID_LICENSE_PLATE', 'Invalid license plate: must be 5–10 alphanumeric characters (A–Z, 0–9)');
    }

    // Prevent duplicates (compare by normalized plate)
    const exists = vehicles.some(v => v.licensePlate === normalizedPlate);
    if (exists) {
        return err('DUPLICATE_LICENSE_PLATE', 'A vehicle with this license plate already exists');
    }

    const newVehicle: Vehicle = {
        id: 'v' + Date.now(),
        licensePlate: normalizedPlate,
        model,
        status: 'Available',
        createdAt: new Date().toISOString()
    };

    vehicles.push(newVehicle);
    persist();
    return { ok: true, data: newVehicle };
}

// LIST all vehicles
export function listVehicles(): Vehicle[] {
  return vehicles;
}

// EDIT vehicle status
export function editVehicleStatus(licensePlate: string, newStatus: VehicleStatus): Result<Vehicle> {
    // Validate new status value
    if (!['Available', 'InUse', 'Maintenance'].includes(newStatus)) {
    return err('INVALID_STATUS', 'Invalid vehicle status');
    }

    const normalizedPlate = normalizePlate(licensePlate);
    const vehicle = vehicles.find(v => v.licensePlate === normalizedPlate);
    if (!vehicle) {
        return err('VEHICLE_NOT_FOUND', 'Vehicle not found');
    }

    // No operation: same status as before
    if (vehicle.status === newStatus) {
        return { ok: true, data: vehicle };
    }

    // Rule: when status is Maintenance, only transition to Available is allowed
    if (vehicle.status === 'Maintenance' && newStatus !== 'Available') {
        return err('ILLEGAL_STATUS_TRANSITION', 'Illegal status transition from Maintenance. Allowed: Available only');
    }
    // Rule: up to 5% of vehicles can be in Maintenance, for small fleets 1 is allowed
    if (newStatus === 'Maintenance' && vehicle.status !== 'Maintenance') {
        const total = vehicles.length;
        const cap = Math.max(1, Math.floor(total * 0.05)); // This ensures at least 1 vehicle is allowed
        const currentMaintenance = vehicles.filter(v => v.status === 'Maintenance').length;
        if (currentMaintenance + 1 > cap) {
        return err('MAINTENANCE_CAP_EXCEEDED', `Maintenance cap exceeded: up to ${cap} vehicles (5%) allowed`);
        }
    }

    // Apply and persist
    vehicle.status = newStatus;
    persist();
    return { ok: true, data: vehicle };
    }


// EDIT an existing vehicle's license plate 
export function editVehicle(id: string, newLicensePlate: string): Result<Vehicle> {
  const vehicle = vehicles.find(v => v.id === id);
  if (!vehicle) {
    return err('VEHICLE_NOT_FOUND', 'Vehicle not found');
  }

  const normalized = normalizePlate(newLicensePlate);
  if (!isValidPlateNorm(normalized)) {
    return err('INVALID_LICENSE_PLATE', 'Invalid license plate: must be 5–10 alphanumeric characters (A–Z, 0–9)');
  }

  // No-op if same normalized
  if (normalized === vehicle.licensePlate) {
    return { ok: true, data: vehicle };
  }

  // Duplicate on other vehicle
  const duplicate = vehicles.some(v => v.licensePlate === normalized && v.id !== id);
  if (duplicate) {
    return err('DUPLICATE_LICENSE_PLATE', 'A vehicle with this license plate already exists');
  }

  vehicle.licensePlate = normalized;
  persist();
  return { ok: true, data: vehicle };
}


// Delete a vehicle by id only when its status is 'Available'. Persist on success.
export function deleteVehicle(id: string): Result<{ deletedId: string }> {
  const index = vehicles.findIndex(v => v.id === id);
  if (index === -1) {
    return err('VEHICLE_NOT_FOUND', 'Vehicle not found');
  }

  const vehicle = vehicles[index];
  if (vehicle.status !== 'Available') {
    return err('NOT_ALLOWED_STATUS_FOR_DELETE', 'Only Available vehicles can be deleted');
  }

  vehicles.splice(index, 1);
  persist();
  return { ok: true, data: { deletedId: id } };
}
