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
  const actualWidth = Math.round(actualHeight * (142 / 38));

  const braceColor = isDark ? '#94a3b8' : '#475569';
  const texColor = isDark ? '#60a5fa' : '#1d4ed8';
  const cellentColor = isDark ? '#f59e0b' : '#b45309';

  return (
    <svg
      width={actualWidth}
      height={actualHeight}
      viewBox="0 0 142 38"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="{TeXcellent}"
      className={`shrink-0 select-none ${className}`}
    >
      <text
        x="71"
        y="26"
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
