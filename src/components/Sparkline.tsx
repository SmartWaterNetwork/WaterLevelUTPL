import React, { useId } from 'react';

interface SparklineProps {
  values: number[];
  color: string;
  /** Drawn as a hairline across the plot when it falls inside the value range. */
  threshold?: number;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * A bare trend line — no axes, no labels. It answers "which way is this going"
 * at a glance; the exact numbers live beside it and in the full hydrograph.
 */
export const Sparkline: React.FC<SparklineProps> = ({
  values,
  color,
  threshold,
  width = 132,
  height = 30,
  className = '',
}) => {
  const gradientId = useId();

  if (values.length < 2) {
    return (
      <div
        className={`flex items-center text-[10px] text-ink-3 ${className}`}
        style={{ width, height }}
      >
        {values.length === 1 ? 'Una sola lectura' : 'Sin serie'}
      </div>
    );
  }

  const pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series would divide by zero; give it a band so it draws mid-height.
  const span = max - min || Math.max(Math.abs(max) * 0.1, 1);
  const lo = max === min ? min - span / 2 : min;

  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - lo) / span) * (height - pad * 2);

  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(values.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`;

  const lastX = x(values.length - 1);
  const lastY = y(values[values.length - 1]);
  const showThreshold = threshold !== undefined && threshold >= lo && threshold <= lo + span;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {showThreshold && (
        <line
          x1={pad}
          x2={width - pad}
          y1={y(threshold)}
          y2={y(threshold)}
          stroke="#d03b3b"
          strokeWidth="1"
          strokeOpacity="0.5"
        />
      )}

      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* 2px surface ring keeps the endpoint legible over the line it sits on. */}
      <circle cx={lastX} cy={lastY} r="3" fill={color} stroke="#ffffff" strokeWidth="2" />
    </svg>
  );
};
