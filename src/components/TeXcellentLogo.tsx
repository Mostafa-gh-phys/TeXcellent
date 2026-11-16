import React from 'react';

interface TeXcellentLogoProps {
  isDark?: boolean;
  height?: number;
  size?: number;
  className?: string;
}

export const TeXcellentLogo: React.FC<TeXcellentLogoProps> = ({
  isDark = false,
  height = 40,
  size,
  className = '',
}) => {
  const actualHeight = size || height;
  const actualWidth = Math.round(actualHeight * (152 / 40));

  // Petroleum blue rounded cadre & curly braces, clearly distinct from TeX and cellent colors
  const petroleumCadre = isDark ? '#1c8ca8' : '#0f4c5c';
  const petroleumFill = isDark ? '#124e5e' : '#0f4c5c';
  const braceColor = isDark ? '#3ab8d6' : '#0b4453';
  const texColor = isDark ? '#60a5fa' : '#1d4ed8';
  const cellentColor = isDark ? '#f59e0b' : '#b45309';

  return (
    <svg
      width={actualWidth}
      height={actualHeight}
      viewBox="0 0 152 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="{TeXcellent}"
      className={`shrink-0 select-none ${className}`}
    >
      <rect
        x="1.25"
        y="1.25"
        width="149.5"
        height="37.5"
        rx="10"
        fill={petroleumFill}
        fillOpacity={isDark ? '0.16' : '0.07'}
        stroke={petroleumCadre}
        strokeWidth="1.8"
      />
      <text
        x="76"
        y="27"
        textAnchor="middle"
        fontFamily="'CMU Serif', 'KaTeX_Main', 'Computer Modern', 'Latin Modern Roman', Georgia, serif"
      >
        <tspan fill={braceColor} fontSize="29" fontWeight="700" dy="2">
          {'{'}
        </tspan>
        <tspan fill={texColor} fontSize="21.5" fontWeight="700" dy="-2" letterSpacing="-0.2px">
          TeX
        </tspan>
        <tspan fill={cellentColor} fontSize="21.5" fontWeight="600" letterSpacing="0.1px">
          cellent
        </tspan>
        <tspan fill={braceColor} fontSize="29" fontWeight="700" dy="2">
          {'}'}
        </tspan>
      </text>
    </svg>
  );
};
