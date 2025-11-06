import React from "react";

interface PowerGaugeProps {
  watts: number;
  maxWatts?: number;
}

export const PowerGauge: React.FC<PowerGaugeProps> = ({ watts, maxWatts = 5000 }) => {
  const percentage = Math.min((watts / maxWatts) * 100, 100);
  const kw = (watts / 1000).toFixed(2);

  const getColor = () => {
    if (percentage < 50) return "#22C55E";
    if (percentage < 75) return "#F59E0B";
    return "#EF4444";
  };

  const C = 88;
  const circumference = 2 * Math.PI * C;

  return (
    <div className="relative w-48 h-48 mx-auto">
      <svg className="transform -rotate-90 w-48 h-48">
        <circle cx="96" cy="96" r={C} stroke="#1F2937" strokeWidth="12" fill="none" />
        <circle
          cx="96"
          cy="96"
          r={C}
          stroke={getColor()}
          strokeWidth="12"
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={`${circumference * (1 - percentage / 100)}`}
          className="transition-all duration-500"
          style={{ filter: `drop-shadow(0 0 8px ${getColor()})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-4xl font-bold text-white">{kw}</div>
        <div className="text-sm text-gray-400">kW</div>
      </div>
    </div>
  );
};
