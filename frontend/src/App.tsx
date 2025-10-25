// frontend/src/App.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  apiListVehicles,
  apiCreateVehicle,
  apiEditStatus,
  apiDeleteVehicle,
  apiEditPlate
} from './api';
import type { Vehicle, VehicleStatus } from './types';
import { errorMessage } from './errorMessages';

/** Detect system theme and react to changes */
function usePrefersDark() {
  const get = () =>
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  const [isDark, setIsDark] = useState<boolean>(get() ?? false);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setIsDark(mql.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  return isDark;
}

/** Build a small design token set based on theme */
function useThemeTokens() {
  const isDark = usePrefersDark();
  const palette = isDark
    ? {
        bg: '#121212',
        surface: '#1E1E1E',
        surface2: '#232323',
        text: '#FFFFFF',
        textMuted: '#B8B8B8',
        border: '#383838',
        accent: '#7CB5FF',
        danger: '#FF6B6B',
        success: '#3DDC84',
        inputBg: '#1A1A1A',
        optionBg: '#1A1A1A'
      }
    : {
        bg: '#F6F7FB',
        surface: '#FFFFFF',
        surface2: '#FAFAFA',
        text: '#1C1C1C',
        textMuted: '#60646C',
        border: '#E5E7EB',
        accent: '#2563EB',
        danger: '#DC2626',
        success: '#16A34A',
        inputBg: '#FFFFFF',
        optionBg: '#FFFFFF'
      };

  const base = {
    radius: 8,
    pad: 10,
    font: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
  };

  return { isDark, palette, base };
}

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
  const { palette, base } = useThemeTokens();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');

  // UI messages
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Filter state (All | specific status)
  const FILTERS: Array<'All' | VehicleStatus> = ['All', 'Available', 'InUse', 'Maintenance'];
  const [filter, setFilter] = useState<'All' | VehicleStatus>('All');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const list = await apiListVehicles();
      setVehicles(list);
      setLoading(false);
    })();
  }, []);

  // Apply filter, then sort
  const filtered = useMemo(() => {
    if (filter === 'All') return vehicles;
    return vehicles.filter(v => v.status === filter);
  }, [vehicles, filter]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [filtered]
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
      setVehicles(vs => vs.map(v => (v.licensePlate === res.data.licensePlate ? res.data : v)));
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

  // Handle license plate edit (normalization/validation/duplication are enforced by backend)
  async function handleEditPlate(id: string, currentPlate: string) {
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

  // Reusable styles
  const styles = {
    app: {
      maxWidth: 900,
      margin: '2rem auto',
      padding: '0 1rem',
      fontFamily: base.font,
      color: palette.text as string,
      backgroundColor: palette.bg as string,
      minHeight: '100vh',
    } as React.CSSProperties,
    h1: { margin: '0 0 12px 0' } as React.CSSProperties,
    card: {
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
      borderRadius: base.radius,
      padding: base.pad,
      marginBottom: 12,
    } as React.CSSProperties,
    input: {
      padding: '8px 10px',
      border: `1px solid ${palette.border}`,
      backgroundColor: palette.inputBg,
      color: palette.text,
      borderRadius: base.radius,
      outline: 'none',
    } as React.CSSProperties,
    button: {
      padding: '8px 12px',
      borderRadius: base.radius,
      border: `1px solid ${palette.border}`,
      backgroundColor: palette.surface2,
      color: palette.text,
      cursor: 'pointer',
    } as React.CSSProperties,
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
      borderRadius: base.radius,
      overflow: 'hidden',
    } as React.CSSProperties,
    th: {
      textAlign: 'left' as const,
      padding: 10,
      borderBottom: `1px solid ${palette.border}`,
      backgroundColor: palette.surface2,
      color: palette.text,
    },
    td: {
      padding: 10,
      borderTop: `1px solid ${palette.border}`,
      color: palette.text,
    } as React.CSSProperties,
    select: {
      padding: '6px 8px',
      border: `1px solid ${palette.border}`,
      borderRadius: base.radius,
      backgroundColor: palette.inputBg,
      color: palette.text,
      cursor: 'pointer',
    } as React.CSSProperties,
    option: {
      backgroundColor: palette.optionBg,
      color: palette.text,
    } as React.CSSProperties,
    ok: { color: palette.success, marginBottom: 12 } as React.CSSProperties,
    err: { color: palette.danger, marginBottom: 12 } as React.CSSProperties,
  };

  return (
    <div style={styles.app}>
      <h1 style={styles.h1}>Vehicle Management</h1>

      {/* Create form */}
      <div style={styles.card}>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="License plate"
            value={plate}
            onChange={e => setPlate(e.target.value)}
            style={styles.input}
          />
          <input
            placeholder="Model"
            value={model}
            onChange={e => setModel(e.target.value)}
            style={styles.input}
          />
          <button type="submit" style={styles.button}>Create</button>
        </form>
      </div>

      {/* Messages */}
      {error && <div style={styles.err}>{error}</div>}
      {ok && <div style={styles.ok}>{ok}</div>}

      {/* Table */}
      {loading ? (
        <div>Loading…</div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>Plate</th>
              <th style={styles.th}>Model</th>

              {/* Status column header with inline filter (Excel-like) */}
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
                      onChange={e => handleStatusChange(v.licensePlate, e.target.value as VehicleStatus)}
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
                      onClick={() => handleEditPlate(v.id, v.licensePlate)}
                      title="Edit license plate"
                      style={{ ...styles.button, marginRight: 6 }}
                    >
                      Edit plate
                    </button>
                    <button
                      onClick={() => handleDelete(v.id, v.status)}
                      disabled={!canDelete}
                      title={canDelete ? 'Delete vehicle' : 'Only Available vehicles can be deleted'}
                      style={{
                        ...styles.button,
                        opacity: canDelete ? 1 : 0.5,
                        cursor: canDelete ? 'pointer' : 'not-allowed'
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
      )}
    </div>
  );
}
