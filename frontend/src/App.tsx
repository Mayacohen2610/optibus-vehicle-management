// frontend/src/App.tsx
import { useEffect, useMemo, useState } from 'react';
import { apiListVehicles } from './api';
import type { Vehicle } from './types';

export default function App() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const list = await apiListVehicles();
      setVehicles(list);
      setLoading(false);
    })();
  }, []);

  const sorted = useMemo(
    () => [...vehicles].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [vehicles]
  );

  return (
    <div style={{ maxWidth: 900, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui' }}>
      <h1>Vehicle Management</h1>

      {loading ? <div>Loading…</div> : (
        <table width="100%" cellPadding={6} style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">ID</th>
              <th align="left">Plate</th>
              <th align="left">Model</th>
              <th align="left">Status</th>
              <th align="left">Created</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(v => (
              <tr key={v.id} style={{ borderTop: '1px solid #ddd' }}>
                <td>{v.id}</td>
                <td>{v.licensePlate}</td>
                <td>{v.model}</td>
                <td>{v.status}</td>
                <td>{new Date(v.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} align="center" style={{ padding: 24, color: '#666' }}>
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
