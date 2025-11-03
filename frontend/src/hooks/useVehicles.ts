import { useEffect, useState } from 'react';
import {
  apiListVehicles,
  apiCreateVehicle,
  apiEditStatus,
  apiDeleteVehicle,
  apiEditPlate,
} from '../api';
import type { Vehicle, VehicleStatus } from '../types';
import { errorMessage } from '../errorMessages';
import { flash } from '../utils';

export function useVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [filter, setFilter] = useState<'All' | VehicleStatus>('All');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const list = await apiListVehicles();
      setVehicles(list);
      setLoading(false);
    })();
  }, []);

  async function create(plate: string, model: string) {
    setError(null);
    setOk(null);

    if (!plate.trim() || !model.trim()) {
      flash(setError, 'License plate and model are required.');
      return;
    }

    const res = await apiCreateVehicle(plate, model);
    if (res.ok) {
      setVehicles(vs => [...vs, res.data]);
      flash(setOk, 'Vehicle created successfully.');
    } else {
      flash(setError, errorMessage(res.error.code));
    }
  }

  async function editStatus(licensePlate: string, next: VehicleStatus) {
    setError(null);
    setOk(null);

    const res = await apiEditStatus(licensePlate, next);
    if (res.ok) {
      setVehicles(vs => vs.map(v => (v.licensePlate === res.data.licensePlate ? res.data : v)));
      flash(setOk, 'Status updated.');
    } else {
      flash(setError, errorMessage(res.error.code));
    }
  }

  async function deleteVehicle(id: string, status: VehicleStatus) {
    setError(null);
    setOk(null);

    if (status !== 'Available') {
      flash(setError, 'Only Available vehicles can be deleted.');
      return;
    }

    const admin = prompt('Enter admin password to confirm deletion:');
    if (!admin) return;

    const res = await apiDeleteVehicle(id, admin);
    if (res.ok) {
      setVehicles(vs => vs.filter(v => v.id !== id));
      flash(setOk, 'Vehicle deleted.');
    } else {
      flash(setError, errorMessage(res.error.code));
    }
  }

  async function editPlate(id: string, currentPlate: string) {
    setError(null);
    setOk(null);

    const next = prompt('Enter new license plate (will be normalized):', currentPlate);
    if (next == null) return; // user canceled
    if (!next.trim()) {
      flash(setError, 'License plate is required.');
      return;
    }

    const res = await apiEditPlate(id, next);
    if (res.ok) {
      setVehicles(vs => vs.map(v => (v.id === id ? res.data : v)));
      flash(setOk, 'License plate updated.');
    } else {
      flash(setError, errorMessage(res.error.code));
    }
  }

  return {
    vehicles,
    loading,
    error,
    ok,
    filter,
    setFilter,
    create,
    editStatus,
    deleteVehicle,
    editPlate,
    setVehicles,
  };
}
