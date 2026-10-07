import { useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleDashed, Info, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'

// Status data uses the reserved status palette (good / warning / serious / critical)
// and always ships an icon + label, so colour never carries the meaning alone.
export type StatusTone = 'good' | 'warning' | 'serious' | 'critical' | 'neutral'
const ICONS: Record<StatusTone, ReactNode> = {
  good: <CheckCircle2 size={14} />, warning: <AlertTriangle size={14} />, serious: <Info size={14} />,
  critical: <XCircle size={14} />, neutral: <CircleDashed size={14} />,
}

export interface Segment { label: string; value: number; tone: StatusTone; onClick?: () => void; active?: boolean }

export function StatusBar({ segments, label }: { segments: Segment[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const total = segments.reduce((n, s) => n + s.value, 0)
  const shown = segments.filter((s) => s.value > 0)
  return (
    <figure className="statusbar" aria-label={label}>
      <div className="statusbar-track" role="img"
        aria-label={`${label}: ${segments.map((s) => `${s.label} ${s.value}`).join(', ')}`}>
        {total === 0 && <div className="statusbar-seg neutral" style={{ flex: 1 }} />}
        {shown.map((s, i) => (
          <button key={s.label} type="button" className={`statusbar-seg ${s.tone} ${hover === i ? 'hover' : ''}`}
            style={{ flexGrow: s.value }} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)} onBlur={() => setHover(null)} onClick={s.onClick} tabIndex={s.onClick ? 0 : -1}
            aria-label={`${s.label}: ${s.value}`}>
            {hover === i && (
              <span className="chart-tip">
                <span className={`swatch ${s.tone}`} />{s.label}<b>{s.value}</b>
                <span className="muted">{total ? Math.round((s.value / total) * 100) : 0}%</span>
              </span>
            )}
          </button>
        ))}
      </div>
      <figcaption className="statusbar-legend">
        {segments.map((s) => (
          <button key={s.label} type="button" className={`legend-item ${s.onClick ? 'clickable' : ''} ${s.active ? 'active' : ''}`}
            onClick={s.onClick} disabled={!s.onClick}>
            <span className={`legend-icon ${s.tone}`}>{ICONS[s.tone]}</span>
            <span className="legend-label">{s.label}</span>
            <span className="legend-value">{s.value}</span>
          </button>
        ))}
      </figcaption>
    </figure>
  )
}
