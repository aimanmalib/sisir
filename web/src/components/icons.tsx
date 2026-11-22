// One stroke family: 1.5 px lines on a 20 px grid, round caps.
const base = { width: 20, height: 20, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

/** The Sisir mark: the reed of a loom, a spine with eight teeth (one per rule). */
export function CombMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" className="mark">
      <rect x="3" y="4" width="22" height="5" rx="1" fill="currentColor" />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={3.5 + i * 2.75} y="9" width="1.5" height={i % 2 ? 13 : 15} fill="currentColor" />
      ))}
    </svg>
  );
}

export function UploadIcon() {
  return (
    <svg {...base}>
      <path d="M10 13V3.5M6.5 7 10 3.5 13.5 7M4 12.5v3A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5v-3" />
    </svg>
  );
}

export function ExternalIcon() {
  return (
    <svg {...base} width={14} height={14}>
      <path d="M8 4H4.5A1.5 1.5 0 0 0 3 5.5v10A1.5 1.5 0 0 0 4.5 17h10a1.5 1.5 0 0 0 1.5-1.5V12M11 3h6v6M17 3l-8 8" />
    </svg>
  );
}

export function ClearIcon() {
  return (
    <svg {...base}>
      <path d="M5 5l10 10M15 5 5 15" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg {...base} width={16} height={16}>
      <rect x="4" y="9" width="12" height="8" rx="1.5" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
    </svg>
  );
}
