import React from 'react';

interface TeXcellentLogoProps {
  accentColor?: string;
  textColor?: string;
  size?: number;
}

export const TeXcellentLogo: React.FC<TeXcellentLogoProps> = ({
  accentColor = '#0969da',
  textColor = 'currentColor',
  size = 26,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect
        x="1.5"
        y="2"
        width="33"
        height="28"
        rx="7"
        fill={accentColor}
        fillOpacity="0.11"
        stroke={accentColor}
        strokeWidth="1.65"
      />
      {/* Left TeX curly brace */}
      <path
        d="M9.2 8.5C7.7 8.5 7.1 9.3 7.1 10.8V13.7C7.1 14.8 6.4 15.6 5.5 16C6.4 16.4 7.1 17.2 7.1 18.3V21.2C7.1 22.7 7.7 23.5 9.2 23.5"
        stroke={textColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right TeX curly brace */}
      <path
        d="M26.8 8.5C28.3 8.5 28.9 9.3 28.9 10.8V13.7C28.9 14.8 29.6 15.6 30.5 16C29.6 16.4 28.9 17.2 28.9 18.3V21.2C28.9 22.7 28.3 23.5 26.8 23.5"
        stroke={textColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Classic lowered-E TeX monogram inside braces (replacing dagger motif) */}
      <text
        x="11.2"
        y="19.5"
        fill={accentColor}
        fontSize="10.5"
        fontWeight="800"
        fontFamily="Georgia, 'Times New Roman', serif"
        letterSpacing="-0.5"
      >
        T
      </text>
      <text
        x="16.1"
        y="21.4"
        fill={textColor}
        fontSize="9.8"
        fontWeight="700"
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        E
      </text>
      <text
        x="20.7"
        y="19.5"
        fill={accentColor}
        fontSize="10.5"
        fontWeight="800"
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        X
      </text>
    </svg>
  );
};
