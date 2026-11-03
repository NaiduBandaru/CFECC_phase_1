import React from 'react';

// Code 128B Patterns (widths of alternating bars and spaces, 3 bars and 3 spaces = 6 elements)
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const START_B = 104;
const STOP = 106;

function encodeCode128B(text: string): string[] {
  const codes: number[] = [START_B];
  let checksum = START_B;

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const value = charCode - 32;
    if (value >= 0 && value <= 95) {
      codes.push(value);
      checksum += value * (i + 1);
    }
  }

  codes.push(checksum % 103);
  codes.push(STOP);

  return codes.map(code => CODE128_PATTERNS[code] || CODE128_PATTERNS[0]);
}

interface BarcodeSvgProps {
  value: string;
  height?: number;
  barWidth?: number;
  showText?: boolean;
  className?: string;
}

export const BarcodeSvg: React.FC<BarcodeSvgProps> = ({
  value,
  height = 40,
  barWidth = 1.5,
  showText = true,
  className = '',
}) => {
  const cleanVal = (value || '000000').toUpperCase();
  const patterns = encodeCode128B(cleanVal);

  let x = 10;
  const rects: React.ReactNode[] = [];

  patterns.forEach((pattern, pIdx) => {
    let isBar = true;
    for (let i = 0; i < pattern.length; i++) {
      const width = parseInt(pattern[i], 10) * barWidth;
      if (isBar) {
        rects.push(
          <rect
            key={`${pIdx}-${i}`}
            x={x}
            y={2}
            width={width}
            height={height}
            fill="#000"
          />
        );
      }
      x += width;
      isBar = !isBar;
    }
  });

  const totalWidth = x + 10;
  const totalHeight = showText ? height + 16 : height + 4;

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <svg
        width={totalWidth}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="max-w-full"
      >
        <rect x={0} y={0} width={totalWidth} height={totalHeight} fill="#fff" />
        {rects}
        {showText && (
          <text
            x={totalWidth / 2}
            y={height + 13}
            textAnchor="middle"
            fill="#111"
            fontSize="10"
            fontFamily="'Courier New', Courier, monospace"
            fontWeight="bold"
            letterSpacing="1.5"
          >
            {cleanVal}
          </text>
        )}
      </svg>
    </div>
  );
};

