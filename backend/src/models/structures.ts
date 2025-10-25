
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
