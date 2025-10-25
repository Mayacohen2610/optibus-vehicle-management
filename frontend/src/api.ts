// frontend/src/api.ts
import type { Vehicle, VehicleStatus, Result, ServiceError } from './types';

const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000/api';

// Generic HTTP helper that returns JSON or { error }
async function http<T>(input: RequestInfo, init?: RequestInit): Promise<T | { error: ServiceError }> {
  const res = await fetch(input, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Backend sends { error: { code, message } } on failure
    return { error: data?.error ?? { code: 'VEHICLE_NOT_FOUND', message: 'Unknown error' } };
  }
  return data as T;
}

// List
export async function apiListVehicles(): Promise<Vehicle[]> {
  const r = await http<Vehicle[]>(`${BASE}/vehicles`);
  if ('error' in r) return []; // you can surface errors later; keep it simple now
  return r;
}

// Create
export async function apiCreateVehicle(licensePlate: string, model: string): Promise<Result<Vehicle>> {
  const r = await http<Vehicle | { error: ServiceError }>(`${BASE}/vehicles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licensePlate, model })
  });
  if ('error' in r) return { ok: false, error: r.error };
  return { ok: true, data: r };
}

// Edit status
export async function apiEditStatus(licensePlate: string, status: VehicleStatus): Promise<Result<Vehicle>> {
  const r = await http<Vehicle | { error: ServiceError }>(`${BASE}/vehicles/${encodeURIComponent(licensePlate)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if ('error' in r) return { ok: false, error: r.error };
  return { ok: true, data: r };
}

// Edit plate
export async function apiEditPlate(id: string, licensePlate: string): Promise<Result<Vehicle>> {
  const r = await http<Vehicle | { error: ServiceError }>(`${BASE}/vehicles/${encodeURIComponent(id)}/plate`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licensePlate })
  });
  if ('error' in r) return { ok: false, error: r.error };
  return { ok: true, data: r };
}

// Delete
export async function apiDeleteVehicle(id: string, adminToken: string): Promise<Result<{ deletedId: string }>> {
  const r = await http<{ deletedId: string } | { error: ServiceError }>(`${BASE}/vehicles/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'x-admin-token': adminToken
    }
  });
  if ('error' in r) return { ok: false, error: r.error };
  return { ok: true, data: r };
}

