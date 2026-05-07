"use client";

import { getScoreColor } from "../lib/format";

interface ScoreGaugeProps {
  value: number;
  label: string;
  size?: number;
}

export default function ScoreGauge({ value, label, size = 90 }: ScoreGaugeProps) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, value));
  const offset = circumference - (progress / 100) * circumference;
  const color = getScoreColor(value);

  return (
    <div className="score-gauge" style={{ width: size, height: size }}>
      <svg
        className="score-gauge-circle"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          className="score-gauge-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="score-gauge-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="score-gauge-text">
        <div className="score-gauge-value" style={{ color }}>
          {Math.round(value)}
        </div>
        <div className="score-gauge-label">{label}</div>
      </div>
    </div>
  );
}
