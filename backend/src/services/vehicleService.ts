
import fs from 'fs';
import path from 'path';
import { VehicleStatus, Vehicle } from '../models/structures';


// Load existing vehicles from JSON file
const dataPath = process.env.DATA_PATH
  ? path.resolve(process.env.DATA_PATH)
  : path.join(__dirname, '..', 'data', 'vehicles.json');

const vehicles: Vehicle[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

// Normalize license plate for reliable comparison
function normalizePlate(p: string): string {
  return (p || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ''); // remove non-alphanumerics (spaces, dashes)
}

// CREATE a new vehicle
export function createVehicle(licensePlate: string, model: string): Vehicle {
  if (!licensePlate) throw new Error('licensePlate is required');
  if (!model) throw new Error('model is required');

  // Normalize before saving
  const normalizedPlate = normalizePlate(licensePlate);

  // Check if this normalized plate already exists
  const exists = vehicles.some(v => v.licensePlate === normalizedPlate);
  if (exists) {
    throw new Error('A vehicle with this license plate already exists');
  }

  const newVehicle: Vehicle = {
    id: 'v' + Date.now(),
    licensePlate: normalizedPlate,  // saved normalized
    model,
    status: 'Available',
    createdAt: new Date().toISOString()
  };

  // Save to "database"
  vehicles.push(newVehicle);
  fs.writeFileSync(dataPath, JSON.stringify(vehicles, null, 2));
  return newVehicle;
}


// LIST all vehicles
export function listVehicles(): Vehicle[] {
  return vehicles;
}

// EDIT vehicle status
export function editVehicleStatus(licensePlate: string, newStatus: VehicleStatus): Vehicle {
    // Validate new status
    if (!['Available', 'InUse', 'Maintenance'].includes(newStatus)) {
        throw new Error('Invalid vehicle status');
    }
    const normalizedPlate = normalizePlate(licensePlate);
    const vehicle = vehicles.find(v => v.licensePlate === normalizedPlate);
    if (!vehicle) {
        throw new Error('Vehicle not found');
    }
    vehicle.status = newStatus;
    fs.writeFileSync(dataPath, JSON.stringify(vehicles, null, 2));
    return vehicle;
    }

// EDIT an existing vehicle's license plate (only if unique)
export function editVehicle(id: string, newLicensePlate: string) {
  const vehicle = vehicles.find(v => v.id === id);
  if (!vehicle) return null; // vehicle not found

  // Check if another vehicle already has this license plate
  const duplicate = vehicles.some(v => v.licensePlate === newLicensePlate && v.id !== id);
  if (duplicate) return null; // license plate already exists

  // Update license plate
  vehicle.licensePlate = newLicensePlate;
  return vehicle;
}

// Delete a vehicle by id only if its status is 'Available'
export function deleteVehicle(id: string) {
  const index = vehicles.findIndex(v => v.id === id);
  if (index === -1) return false; // vehicle not found

  const vehicle = vehicles[index];
  if (vehicle.status !== 'Available') return false; // can't delete InUse / Maintenance vehicles

  vehicles.splice(index, 1);
  return true;
}
