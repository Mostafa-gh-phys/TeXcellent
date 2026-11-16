import React from 'react';

interface TeXcellentLogoProps {
  accentColor?: string;
  textColor?: string;
  height?: number;
  size?: number;
  className?: string;
}

export const TeXcellentLogo: React.FC<TeXcellentLogoProps> = ({
  accentColor = '#0969da',
  textColor = 'currentColor',
  height = 38,
  size,
  className = '',
}) => {
  const actualHeight = size || height;
  const actualWidth = Math.round(actualHeight * (138 / 38));

  return (
    <svg
      width={actualWidth}
      height={actualHeight}
      viewBox="0 0 138 38"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="{TeXcellent}"
      className={`shrink-0 select-none ${className}`}
    >
      <rect
        x="1"
        y="1"
        width="136"
        height="36"
        rx="9"
        fill={accentColor}
        fillOpacity="0.10"
        stroke={accentColor}
        strokeWidth="1.5"
      />
      <text
        x="69"
        y="25.5"
        textAnchor="middle"
        fontFamily="'CMU Serif', 'KaTeX_Main', 'Computer Modern', 'Latin Modern Roman', Georgia, serif"
        fontSize="20.5"
        letterSpacing="0.1px"
      >
        <tspan fill={accentColor} fontWeight="700">
          {'{'}
        </tspan>
        <tspan fill={accentColor} fontWeight="700">
          TeX
        </tspan>
        <tspan fill={textColor} fontWeight="500">
          cellent
        </tspan>
        <tspan fill={accentColor} fontWeight="700">
          {'}'}
        </tspan>
      </text>
    </svg>
  );
};
