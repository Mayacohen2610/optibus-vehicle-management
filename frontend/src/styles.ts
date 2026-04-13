import type { CSSProperties } from 'react';

// Keep styles centralized but still theme-aware. This returns an object of style
// factories that the app and components can consume.
export function getStyles(palette: any, base: any) {
  const styles: Record<string, CSSProperties> = {
    app: {
      maxWidth: 900,
      margin: '2rem auto',
      padding: '0 1rem 1.5rem',
      fontFamily: base.font,
      color: palette.text,
      backgroundColor: palette.bg,
      minHeight: '100vh',
      lineHeight: 1.5,
    },
    h1: { margin: '0 0 12px 0', letterSpacing: '0.2px' },
    card: {
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
      borderRadius: base.radius,
      padding: base.pad + 2,
      marginBottom: 14,
      boxShadow: '0 8px 20px rgba(8, 19, 37, 0.08)',
    },
    input: {
      padding: '8px 10px',
      border: `1px solid ${palette.border}`,
      backgroundColor: palette.inputBg,
      color: palette.text,
      borderRadius: base.radius,
      outline: 'none',
      fontSize: '0.95rem',
    },
    button: {
      padding: '8px 12px',
      borderRadius: base.radius,
      border: `1px solid ${palette.accent}`,
      backgroundColor: palette.accent,
      color: '#FFFFFF',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'filter 150ms ease, transform 150ms ease',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
      borderRadius: base.radius,
      overflow: 'hidden',
    },
    th: {
      textAlign: 'left' as const,
      padding: 10,
      borderBottom: `1px solid ${palette.border}`,
      backgroundColor: palette.surface2,
      color: palette.text,
      fontWeight: 700,
    },
    td: {
      padding: 10,
      borderTop: `1px solid ${palette.border}`,
      color: palette.text,
    },
    select: {
      padding: '6px 8px',
      border: `1px solid ${palette.border}`,
      borderRadius: base.radius,
      backgroundColor: palette.inputBg,
      color: palette.text,
      cursor: 'pointer',
      fontSize: '0.95rem',
    },
    option: {
      backgroundColor: palette.optionBg,
      color: palette.text,
    },
    ok: { color: palette.success, marginBottom: 12 },
    err: { color: palette.danger, marginBottom: 12 },
  };

  return styles;
}
