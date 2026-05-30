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

        {/* Premium Warm Golden Ivory Sheen Gradient (Skeleton UI inspired) */}
        <linearGradient id="premium-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255, 255, 255, 0)" />
          <stop offset="15%" stopColor="rgba(255, 255, 255, 0.05)" />
          <stop offset="35%" stopColor="rgba(255, 255, 255, 0.35)" />
          <stop offset="50%" stopColor="rgba(255, 238, 185, 0.95)" />
          <stop offset="65%" stopColor="rgba(255, 255, 255, 0.35)" />
          <stop offset="85%" stopColor="rgba(255, 255, 255, 0.05)" />
          <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
        </linearGradient>

        {/* Clipping path mapping strictly to the P-logo shape */}
        <clipPath id="logo-shape-clip">
          <path d="M22 8 L66 8 A14 14 0 0 1 80 22 L80 34 A14 14 0 0 1 66 48 L54 48 A14 14 0 0 0 40 62 L40 66 A14 14 0 0 1 26 80 L22 80 A14 14 0 0 1 8 66 L8 22 A14 14 0 0 1 22 8 Z" />
        </clipPath>

        {/* Outer clipping path for the whole card to keep shimmer encapsulated within rounded corners */}
        <clipPath id="logo-card-clip">
          <rect width="88" height="88" rx="22" />
        </clipPath>

        {/* Encapsulated GPU-accelerated styling for continuous skeleton-style sweep */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes skeleton-sheen-sweep {
            0% {
              transform: translateX(-140px) translateY(-30px) rotate(22deg);
            }
            100% {
              transform: translateX(140px) translateY(-30px) rotate(22deg);
            }
          }
          .animate-logo-gold-rim {
            stroke-dasharray: 340;
            stroke-dashoffset: 0;
          }
          .animate-skeleton-shimmer {
            animation: skeleton-sheen-sweep 2.8s linear infinite;
          }
        `}} />
      </defs>

      {/* Group clipped strictly to the outer card shape with 22px rx */}
      <g clipPath="url(#logo-card-clip)">
        {/* Luxury double-layered card background */}
        <rect width="88" height="88" fill="url(#brand-logo-gradient)" />
        
        {/* Exquisite gold boundary frame */}
        <rect x="1.5" y="1.5" width="85" height="85" rx="20.5" fill="none" stroke="url(#gold-rim-gradient)" strokeWidth="2.5" className="opacity-90 animate-logo-gold-rim" />

        {/* Golden accent inner shadow helper */}
        <rect x="4" y="4" width="80" height="80" rx="18" fill="none" stroke="#FFFFFF" strokeWidth="1" className="opacity-25" />

        {/* Group clipped strictly directly to the P-shaped bounds */}
        <g clipPath="url(#logo-shape-clip)">
          {/* Solid elegant white background branding shape */}
          <path
            d="M22 8 L66 8 A14 14 0 0 1 80 22 L80 34 A14 14 0 0 1 66 48 L54 48 A14 14 0 0 0 40 62 L40 66 A14 14 0 0 1 26 80 L22 80 A14 14 0 0 1 8 66 L8 22 A14 14 0 0 1 22 8 Z"
            fill="white"
          />
        </g>

        {/* Consistent Master Skeleton Shimmer Sweep covering the ENTIRE CARD (background, gold border, and shape together) */}
        <rect
          x="-30"
          y="-30"
          width="50"
          height="160"
          fill="url(#premium-sheen)"
          className="animate-skeleton-shimmer"
          style={{ mixBlendMode: "overlay", pointerEvents: "none" }}
        />
      </g>
    </svg>
  );
}
