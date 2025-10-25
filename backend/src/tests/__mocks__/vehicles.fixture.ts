export type Vehicle = {
  id: string;
  licensePlate: string;
  model: string;  
  status: 'Available' | 'InUse' | 'Maintenance';
  createdAt: string;
};

export const baseVehicles: Vehicle[] = [
  { id: '1', licensePlate: '11-AAA-11', model: 'Model-A', status: 'Available',   createdAt: '2025-01-01T00:00:00Z' },
  { id: '2', licensePlate: '22-BBB-22', model: 'Model-B', status: 'InUse',       createdAt: '2025-01-02T00:00:00Z' },
  { id: '3', licensePlate: '33-CCC-33', model: 'Model-C', status: 'Maintenance', createdAt: '2025-01-03T00:00:00Z' }
];

export const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
