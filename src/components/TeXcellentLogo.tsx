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
  height = 30,
  size,
  className = '',
}) => {
  const actualHeight = size || height;
  const actualWidth = Math.round(actualHeight * (128 / 32));

  return (
    <svg
      width={actualWidth}
      height={actualHeight}
      viewBox="0 0 128 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="{TeXcellent}"
      className={`shrink-0 select-none ${className}`}
    >
      <rect
        x="1.5"
        y="2"
        width="125"
        height="28"
        rx="8"
        fill={accentColor}
        fillOpacity="0.08"
        stroke={accentColor}
        strokeWidth="1.25"
      />
      <text
        x="64"
        y="20.5"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
        fontSize="14.5"
        letterSpacing="0.25px"
      >
        <tspan fill={accentColor} fontWeight="700" opacity="0.9">
          {'{'}
        </tspan>
        <tspan fill={accentColor} fontWeight="800">
          TeX
        </tspan>
        <tspan fill={textColor} fontWeight="600">
          cellent
        </tspan>
        <tspan fill={accentColor} fontWeight="700" opacity="0.9">
          {'}'}
        </tspan>
      </text>
    </svg>
  );
};
