import type { FormEvent, CSSProperties } from 'react';

interface Props {
  plate: string;
  model: string;
  setPlate: (s: string) => void;
  setModel: (s: string) => void;
  onCreate: (e: FormEvent) => void;
  styles: Record<string, CSSProperties>;
}

export default function CreateForm({ plate, model, setPlate, setModel, onCreate, styles }: Props) {
  return (
    <div style={styles.card}>
      <form onSubmit={onCreate} style={{ display: 'flex', gap: 8 }}>
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
  );
}
