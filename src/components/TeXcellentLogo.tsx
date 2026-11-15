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
  height = 36,
  size,
  className = '',
}) => {
  const actualHeight = size || height;
  // Adjusted aspect ratio for a snug fit around {TeXcellent}
  const actualWidth = Math.round(actualHeight * (112 / 34));

  return (
    <svg
      width={actualWidth}
      height={actualHeight}
      viewBox="0 0 112 34"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="{TeXcellent}"
      className={`shrink-0 select-none ${className}`}
    >
      <rect
        x="1"
        y="1"
        width="110"
        height="32"
        rx="8"
        fill={accentColor}
        fillOpacity="0.10"
        stroke={accentColor}
        strokeWidth="1.5"
      />
      <text
        x="56"
        y="22"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
        fontSize="15.5"
        letterSpacing="0.3px"
      >
        <tspan fill={accentColor} fontWeight="700" opacity="0.95">
          {'{'}
        </tspan>
        <tspan fill={accentColor} fontWeight="800">
          TeX
        </tspan>
        <tspan fill={textColor} fontWeight="600">
          cellent
        </tspan>
        <tspan fill={accentColor} fontWeight="700" opacity="0.95">
          {'}'}
        </tspan>
      </text>
    </svg>
  );
};
