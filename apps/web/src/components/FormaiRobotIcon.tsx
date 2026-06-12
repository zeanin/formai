import React from 'react';

export interface FormaiRobotIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  spin?: boolean;
}

export function FormaiRobotIcon({ size = '1em', style, spin, ...props }: FormaiRobotIconProps) {
  const spinStyle: React.CSSProperties = spin
    ? {
        animation: 'formai-spin 2s linear infinite',
      }
    : {};

  return (
    <>
      <style>{`
        @keyframes formai-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <svg
        viewBox="0 0 1024 1024"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
        aria-hidden="true"
        style={{
          display: 'inline-block',
          color: 'inherit',
          fontStyle: 'normal',
          lineHeight: '0',
          textAlign: 'center',
          textTransform: 'none',
          verticalAlign: '-0.125em',
          textRendering: 'optimizeLegibility',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          transformOrigin: 'center',
          ...spinStyle,
          ...style
        }}
        {...props}
      >
        {/* Outer head rounded square */}
        <rect x="200" y="150" width="624" height="600" rx="80" strokeWidth="64" />
        
        {/* Eye connection bridge */}
        <line x1="380" y1="430" x2="644" y2="430" strokeWidth="32" />
        
        {/* Left eye circle */}
        <circle cx="380" cy="430" r="75" fill="currentColor" stroke="none" />
        
        {/* Right eye circle */}
        <circle cx="644" cy="430" r="75" fill="currentColor" stroke="none" />
        
        {/* Curved smiling mouth */}
        <path d="M 420 590 Q 512 670 604 590" strokeWidth="48" fill="none" />
        
        {/* Stand neck connectors */}
        <line x1="430" y1="750" x2="430" y2="860" strokeWidth="48" />
        <line x1="594" y1="750" x2="594" y2="860" strokeWidth="48" />
        
        {/* Stand base plate */}
        <line x1="320" y1="860" x2="704" y2="860" strokeWidth="64" />
      </svg>
    </>
  );
}
