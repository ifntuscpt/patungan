import React from "react";

interface AppLogoProps {
  size?: number | string;
  className?: string;
}

export function AppLogo({ size = 56, className = "" }: AppLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 88 88"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 drop-shadow-md ${className}`}
    >
      <defs>
        {/* Luxury rich emerald gradient */}
        <linearGradient id="brand-logo-gradient" x1="0" y1="0" x2="88" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#05e665" />
          <stop offset="45%" stopColor="#00A840" />
          <stop offset="100%" stopColor="#004D1C" />
        </linearGradient>
        
        {/* High-end metallic gold rim gradient */}
        <linearGradient id="gold-rim-gradient" x1="0" y1="0" x2="88" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFE082" />
          <stop offset="50%" stopColor="#FFC107" />
          <stop offset="100%" stopColor="#FF8F00" />
        </linearGradient>

        {/* Dynamic diagonal shimmer sheen sweep */}
        <linearGradient id="shimmer-sweeper" x1="-150%" y1="-150%" x2="-50%" y2="-50%">
          <stop offset="0%" stopColor="rgba(255, 255, 255, 0)" />
          <stop offset="40%" stopColor="rgba(255, 255, 255, 0)" />
          <stop offset="50%" stopColor="rgba(255, 255, 255, 0.95)" />
          <stop offset="60%" stopColor="rgba(255, 255, 255, 0)" />
          <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
          
          <animate 
            attributeName="x1" 
            from="-150%" 
            to="150%" 
            dur="2.2s" 
            repeatCount="indefinite" 
          />
          <animate 
            attributeName="x2" 
            from="-50%" 
            to="250%" 
            dur="2.2s" 
            repeatCount="indefinite" 
          />
          <animate 
            attributeName="y1" 
            from="-150%" 
            to="150%" 
            dur="2.2s" 
            repeatCount="indefinite" 
          />
          <animate 
            attributeName="y2" 
            from="-50%" 
            to="250%" 
            dur="2.2s" 
            repeatCount="indefinite" 
          />
        </linearGradient>
      </defs>

      {/* Luxury double-layered card background */}
      <rect width="88" height="88" rx="22" fill="url(#brand-logo-gradient)" />
      
      {/* Exquisite gold boundary frame */}
      <rect x="1.5" y="1.5" width="85" height="85" rx="20.5" fill="none" stroke="url(#gold-rim-gradient)" strokeWidth="2.5" className="opacity-80" />

      {/* Golden accent inner shadow helper */}
      <rect x="4" y="4" width="80" height="80" rx="18" fill="none" stroke="#FFFFFF" strokeWidth="1" className="opacity-20" />

      {/* Main clean white P-logo route */}
      <path
        id="logo-base-path"
        d="M22 8 L66 8 A14 14 0 0 1 80 22 L80 34 A14 14 0 0 1 66 48 L54 48 A14 14 0 0 0 40 62 L40 66 A14 14 0 0 1 26 80 L22 80 A14 14 0 0 1 8 66 L8 22 A14 14 0 0 1 22 8 Z"
        fill="white"
      />

      {/* Shimmer sheen overlay mapping directly to the logo shape */}
      <path
        d="M22 8 L66 8 A14 14 0 0 1 80 22 L80 34 A14 14 0 0 1 66 48 L54 48 A14 14 0 0 0 40 62 L40 66 A14 14 0 0 1 26 80 L22 80 A14 14 0 0 1 8 66 L8 22 A14 14 0 0 1 22 8 Z"
        fill="url(#shimmer-sweeper)"
        style={{ mixBlendMode: "overlay" }}
      />
    </svg>
  );
}
