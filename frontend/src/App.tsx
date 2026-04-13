// frontend/src/App.tsx
import { useState } from 'react';
// types are imported where needed in child components/hooks
import { useThemeTokens } from './utils';
import { getStyles } from './styles';
import CreateForm from './components/CreateForm';
import VehicleTable from './components/VehicleTable';
import { useVehicles } from './hooks/useVehicles';



export default function App() {
  const { palette, base } = useThemeTokens();
  // state and handlers from custom hook
  const {
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
  } = useVehicles();

  // Create form state
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await create(plate, model);
    // reset form only on success - create() flashes messages; assume success when there's no error
    setPlate('');
    setModel('');
  }

  // get centralized styles
  const styles = getStyles(palette, base);

  return (
    <div style={styles.app}>
      <h1 style={styles.h1}>Vehicle Management</h1>

      {/* Create form */}
      <CreateForm
        plate={plate}
        model={model}
        setPlate={setPlate}
        setModel={setModel}
        onCreate={handleCreate}
        styles={styles}
      />

      {/* Messages */}
      {error && <div style={styles.err}>{error}</div>}
      {ok && <div style={styles.ok}>{ok}</div>}

      <VehicleTable
        vehicles={vehicles}
        loading={loading}
        filter={filter}
        setFilter={f => setFilter(f)}
        onStatusChange={editStatus}
        onDelete={deleteVehicle}
        onEditPlate={editPlate}
        styles={styles}
        palette={palette}
      />
    </div>
  );
}
