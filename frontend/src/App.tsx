// frontend/src/App.tsx
import { useEffect, useMemo, useState } from 'react';
import { apiListVehicles, apiCreateVehicle, apiEditStatus, apiDeleteVehicle } from './api';
import type { Vehicle, VehicleStatus } from './types';
import { errorMessage } from './errorMessages';


// Simple helper to reset async messages after a while
function flash(setter: (s: string | null) => void, text: string, ms = 3500) {
  setter(text);
  setTimeout(() => setter(null), ms);
}

const ALL_STATUSES: VehicleStatus[] = ['Available', 'InUse', 'Maintenance'];

// Compute per-row options with disabled flags
function statusOptionsForRow(current: VehicleStatus, fleet: Vehicle[]) {
  const total = fleet.length;
  const cap = Math.max(1, Math.floor(total * 0.05)); // UI hint; backend still enforces
  const currentMaintenance = fleet.filter(v => v.status === 'Maintenance').length;

  const canEnterMaintenance = current !== 'Maintenance' && currentMaintenance < cap;

  return ALL_STATUSES.map(value => {
    // 1) From Maintenance → only Allowed to Available
    const disallowFromMaintenance = current === 'Maintenance' && value === 'InUse';

    // 2) Block entering Maintenance when cap reached (unless already in it)
    const disallowEnterMaintenance =
      current !== 'Maintenance' && value === 'Maintenance' && !canEnterMaintenance;

    return {
      value,
      disabled: disallowFromMaintenance || disallowEnterMaintenance,
    };
  });
}


export default function App() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');

  // UI messages
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const list = await apiListVehicles();
      setVehicles(list);
      setLoading(false);
    })();
  }, []);

  // Keep table deterministic (optional)
  const sorted = useMemo(
    () => [...vehicles].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [vehicles]
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);

    // Basic front-end guard (backend still validates strictly)
    if (!plate.trim() || !model.trim()) {
      flash(setError, 'License plate and model are required.');
      return;
    }

    const res = await apiCreateVehicle(plate, model);
    if (res.ok) {
      // Append new vehicle to the list
      setVehicles(vs => [...vs, res.data]);
      setPlate('');
      setModel('');
      flash(setOk, 'Vehicle created successfully.');
    } else {
      flash(setError, errorMessage(res.error.code));
    }
  }

  // Handle status change from the table select
  async function handleStatusChange(licensePlate: string, next: VehicleStatus) {
    setError(null);
    setOk(null);

    const res = await apiEditStatus(licensePlate, next);
    if (res.ok) {
      // Replace the updated vehicle in state
      setVehicles(vs => vs.map(v => v.licensePlate === res.data.licensePlate ? res.data : v));
      flash(setOk, 'Status updated.');
    } else {
      flash(setError, errorMessage(res.error.code));
    }
  }

  // Handle deletion (requires admin token and only when status is 'Available')
  async function handleDelete(id: string, status: VehicleStatus) {
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


  return (
    <div style={{ maxWidth: 900, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui' }}>
      <h1>Vehicle Management</h1>

      {/* Create form */}
      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, margin: '1rem 0' }}>
        <input
          placeholder="License plate"
          value={plate}
          onChange={e => setPlate(e.target.value)}
        />
        <input
          placeholder="Model"
          value={model}
          onChange={e => setModel(e.target.value)}
        />
        <button type="submit">Create</button>
      </form>

      {/* Messages */}
      {error && <div style={{ color: 'crimson', marginBottom: 12 }}>{error}</div>}
      {ok && <div style={{ color: 'seagreen', marginBottom: 12 }}>{ok}</div>}

      {/* Table */}
      {loading ? <div>Loading…</div> : (
        <table width="100%" cellPadding={6} style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">ID</th>
              <th align="left">Plate</th>
              <th align="left">Model</th>
              <th align="left">Status</th>
              <th align="left">Created</th>
              <th align="center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(v => {
              const opts = statusOptionsForRow(v.status, vehicles);
              const canDelete = v.status === 'Available';
              return (
                <tr key={v.id} style={{ borderTop: '1px solid #ddd' }}>
                  <td>{v.id}</td>
                  <td>{v.licensePlate}</td>
                  <td>{v.model}</td>
                  <td>
                    <select
                      value={v.status}
                      onChange={e => handleStatusChange(v.licensePlate, e.target.value as VehicleStatus)}
                    >
                      {opts.map(o => (
                        <option key={o.value} value={o.value} disabled={o.disabled}>
                          {o.value}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{new Date(v.createdAt).toLocaleString()}</td>
                  <td align="center">
                    <button
                      onClick={() => handleDelete(v.id, v.status)}
                      disabled={!canDelete}
                      title={canDelete ? 'Delete vehicle' : 'Only Available vehicles can be deleted'}
                      style={{ opacity: canDelete ? 1 : 0.5, cursor: canDelete ? 'pointer' : 'not-allowed' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} align="center" style={{ padding: 24, color: '#666' }}>
                  No vehicles yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

    </div>
  );
}
