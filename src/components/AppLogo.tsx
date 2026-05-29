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
      className={`shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id="brand-logo-gradient" x1="0" y1="0" x2="88" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#00D95F" />
          <stop offset="100%" stop-color="#006227" />
        </linearGradient>
      </defs>
      <rect width="88" height="88" rx="22" fill="url(#brand-logo-gradient)" />
      <path
        d="M22 8 L66 8 A14 14 0 0 1 80 22 L80 34 A14 14 0 0 1 66 48 L54 48 A14 14 0 0 0 40 62 L40 66 A14 14 0 0 1 26 80 L22 80 A14 14 0 0 1 8 66 L8 22 A14 14 0 0 1 22 8 Z"
        fill="white"
      />
    </svg>
  );
}
