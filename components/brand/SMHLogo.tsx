"use client";

import React from "react";
import Link from "next/link";

interface SMHLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  collapsed?: boolean;
  className?: string;
  href?: string;
}

export const SMHLogo: React.FC<SMHLogoProps> = ({
  size = "md",
  showText = true,
  collapsed = false,
  className = "",
  href,
}) => {
  // Size metrics
  const sizeMap = {
    sm: { icon: 28, text: "text-base", sub: "text-[9px]" },
    md: { icon: 38, text: "text-xl", sub: "text-[10px]" },
    lg: { icon: 48, text: "text-2xl", sub: "text-xs" },
    xl: { icon: 64, text: "text-4xl", sub: "text-sm" },
  };

  const { icon, text, sub } = sizeMap[size];

  // Stylized MindX-inspired polygonal Geometric "X" combined with SMH emblem
  const LogoIcon = (
    <svg
      width={icon}
      height={icon}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0 drop-shadow-md transition-transform duration-300 hover:scale-105"
    >
      <defs>
        {/* Gradients inspired by MindX Ruby Crimson & Sunset coral */}
        <linearGradient id="mindxRed1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F43F5E" />
          <stop offset="100%" stopColor="#E11D48" />
        </linearGradient>
        <linearGradient id="mindxRed2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#BE123C" />
          <stop offset="100%" stopColor="#9F1239" />
        </linearGradient>
        <linearGradient id="mindxAmber" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FB7185" />
          <stop offset="100%" stopColor="#E11D48" />
        </linearGradient>
        <linearGradient id="mindxDark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#881337" />
          <stop offset="100%" stopColor="#4C0519" />
        </linearGradient>
      </defs>

      {/* Rounded squircle emblem background */}
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        rx="24"
        className="fill-slate-100 dark:fill-[#0D1117] stroke-rose-500/20 dark:stroke-rose-500/35 transition-colors"
        strokeWidth="3"
      />

      {/* Geometric Polygonal 'X' facets inspired by MindX */}
      {/* Top Left wing */}
      <polygon
        points="24,20 46,20 34,46 16,36"
        fill="url(#mindxRed1)"
        className="transition-opacity hover:opacity-90"
      />
      {/* Top Right wing */}
      <polygon
        points="76,20 54,20 66,46 84,36"
        fill="url(#mindxAmber)"
        className="transition-opacity hover:opacity-90"
      />
      {/* Center diamond core */}
      <polygon
        points="50,38 64,50 50,62 36,50"
        fill="#FFFFFF"
        opacity="0.95"
      />
      <polygon
        points="50,42 58,50 50,58 42,50"
        fill="url(#mindxRed1)"
      />
      {/* Bottom Left wing */}
      <polygon
        points="16,64 34,54 46,80 24,80"
        fill="url(#mindxDark)"
        className="transition-opacity hover:opacity-90"
      />
      {/* Bottom Right wing */}
      <polygon
        points="84,64 66,54 54,80 76,80"
        fill="url(#mindxRed2)"
        className="transition-opacity hover:opacity-90"
      />
      
      {/* Dynamic central pulse dot */}
      <circle cx="50" cy="50" r="3" fill="#FFFFFF" />
    </svg>
  );

  const LogoText = showText && !collapsed && (
    <div className="flex flex-col select-none leading-none">
      <div className="flex items-center gap-1">
        <span className={`font-black tracking-tight text-slate-900 dark:text-white ${text} flex items-center transition-colors`}>
          S<span className="text-rose-600 dark:text-rose-500">M</span>H
        </span>
      </div>
      <span className={`text-slate-500 dark:text-slate-400 font-bold tracking-wider uppercase mt-0.5 ${sub} transition-colors`}>
        School MindX Hub
      </span>
    </div>
  );

  const content = (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {LogoIcon}
      {LogoText}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center transition-opacity hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
};
