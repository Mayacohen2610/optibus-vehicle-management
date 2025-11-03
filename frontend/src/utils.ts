import { useEffect, useState } from 'react';
import type { Vehicle, VehicleStatus } from './types';

/** Detect system theme and react to changes */
export function usePrefersDark() {
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
export function useThemeTokens() {
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

  return { isDark, palette, base } as const;
}

// Simple helper to reset async messages after a while
export function flash(setter: (s: string | null) => void, text: string, ms = 3500) {
  setter(text);
  setTimeout(() => setter(null), ms);
}

export const ALL_STATUSES: VehicleStatus[] = ['Available', 'InUse', 'Maintenance'];

// Compute per-row options with disabled flags
export function statusOptionsForRow(current: VehicleStatus, fleet: Vehicle[]) {
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
