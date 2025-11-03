import type { Vehicle, VehicleStatus } from '../types';
import type { CSSProperties } from 'react';
import { statusOptionsForRow } from '../utils';

interface Props {
  vehicles: Vehicle[];
  loading: boolean;
  filter: 'All' | VehicleStatus;
  setFilter: (f: 'All' | VehicleStatus) => void;
  onStatusChange: (licensePlate: string, next: VehicleStatus) => void;
  onDelete: (id: string, status: VehicleStatus) => void;
  onEditPlate: (id: string, currentPlate: string) => void;
  styles: Record<string, CSSProperties>;
  palette: any;
}

export default function VehicleTable({
  vehicles,
  loading,
  filter,
  setFilter,
  onStatusChange,
  onDelete,
  onEditPlate,
  styles,
  palette,
}: Props) {
  if (loading) return <div>Loading…</div>;

  const filtered = filter === 'All' ? vehicles : vehicles.filter(v => v.status === filter);
  const sorted = filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>ID</th>
          <th style={styles.th}>Plate</th>
          <th style={styles.th}>Model</th>
          <th style={styles.th}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Status</span>
              <select
                value={filter}
                onChange={e => setFilter(e.target.value as 'All' | VehicleStatus)}
                title="Filter by status"
                style={styles.select}
              >
                {(['All', 'Available', 'InUse', 'Maintenance'] as Array<'All' | VehicleStatus>).map(f => (
                  <option key={f} value={f} style={styles.option}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </th>

          <th style={styles.th}>Created</th>
          <th style={{ ...styles.th, textAlign: 'center' }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map(v => {
          const opts = statusOptionsForRow(v.status, vehicles);
          const canDelete = v.status === 'Available';
          return (
            <tr key={v.id}>
              <td style={styles.td}>{v.id}</td>
              <td style={styles.td}>{v.licensePlate}</td>
              <td style={styles.td}>{v.model}</td>
              <td style={styles.td}>
                <select
                  value={v.status}
                  onChange={e => onStatusChange(v.licensePlate, e.target.value as VehicleStatus)}
                  style={styles.select}
                >
                  {opts.map(o => (
                    <option key={o.value} value={o.value} disabled={o.disabled} style={styles.option}>
                      {o.value}
                    </option>
                  ))}
                </select>
              </td>
              <td style={styles.td}>{new Date(v.createdAt).toLocaleString()}</td>
              <td style={{ ...styles.td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                <button
                  onClick={() => onEditPlate(v.id, v.licensePlate)}
                  title="Edit license plate"
                  style={{ ...styles.button, marginRight: 6 }}
                >
                  Edit plate
                </button>
                <button
                  onClick={() => onDelete(v.id, v.status)}
                  disabled={!canDelete}
                  title={canDelete ? 'Delete vehicle' : 'Only Available vehicles can be deleted'}
                  style={{
                    ...styles.button,
                    opacity: canDelete ? 1 : 0.5,
                    cursor: canDelete ? 'pointer' : 'not-allowed',
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          );
        })}

        {sorted.length === 0 && (
          <tr>
            <td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: palette.textMuted, padding: 24 }}>
              No vehicles yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
