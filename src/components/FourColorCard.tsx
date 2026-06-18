import React from 'react';
import { Card } from '../types';

interface FourColorCardProps {
  card: Card;
  isRevealed?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const FourColorCard: React.FC<FourColorCardProps> = ({
  card,
  isRevealed = true,
  isSelected = false,
  onClick,
  disabled = false,
  size = 'md',
}) => {
  // Map colors to beautiful theme palettes matching the uploaded traditional image
  // Yellow: Bright solid yellow background, blood-red ink
  // Green: Rich kelly green background, charcoal-black ink
  // Red: High-saturation vibrant orange-red background, charcoal-black ink
  // White: Crisp solid white background, charcoal-black ink
  const colorThemes = {
    yellow: {
      bg: 'bg-[#ffd300] border-[#cca200]',
      text: 'text-[#ab1313]',
      border: 'border-[#ab1313]',
      badge: 'bg-[#ffee55] text-[#800000]',
      centerSymbol: '🔴',
      inkColor: 'border-[#ab1313]/50 text-[#ab1313]',
    },
    green: {
      bg: 'bg-[#299c42] border-[#1d7330]',
      text: 'text-[#111111] font-black',
      border: 'border-[#111111]',
      badge: 'bg-[#5cd478]/40 text-black',
      centerSymbol: '🟢',
      inkColor: 'border-black/50 text-[#111111]',
    },
    red: {
      bg: 'bg-[#ff5511] border-[#ce440d]',
      text: 'text-[#111111] font-black',
      border: 'border-[#111111]',
      badge: 'bg-[#ff8855]/40 text-black',
      centerSymbol: '⚫',
      inkColor: 'border-black/50 text-[#111111]',
    },
    white: {
      bg: 'bg-[#ffffff] border-[#dddddd]',
      text: 'text-[#111111]',
      border: 'border-[#111111]',
      badge: 'bg-zinc-200 text-black',
      centerSymbol: '⚪',
      inkColor: 'border-black/50 text-[#111111]',
    },
  };

  const theme = colorThemes[card.color] || colorThemes.white;

  // Sizes
  const sizeClasses = {
    sm: 'w-10 h-[100px] text-sm lg:h-[105px]',
    md: 'w-[45px] h-[118px] text-base lg:h-[122px]',
    lg: 'w-[54px] h-[138px] text-lg lg:h-[142px]',
  };

  // Font sizes specifically for authentic huge woodblock-print character look
  const fontSizeClasses = {
    sm: 'text-[25px] md:text-[27px]',
    md: 'text-[35px] md:text-[37px]',
    lg: 'text-[44px] md:text-[46px]',
  };

  // Center icons or stamps removed at user request to increase simplicity and allow shorter heights
  const getCenterDecoration = () => {
    return null;
  };

  // Traditional woodblock print banner decorations at top and bottom inside frames
  const getDecoration = (char: string) => {
    const commonClass = "w-[80%] max-h-[10px] opacity-95";
    switch (char) {
      case '帥':
      case '將':
        return (
          <svg viewBox="0 0 40 10" className={commonClass} fill="currentColor">
            <rect x="2" y="1" width="36" height="2" />
            <rect x="10" y="5" width="20" height="2" />
          </svg>
        );
      case '仕':
      case '士':
        return (
          <svg viewBox="0 0 40 10" className={commonClass} fill="currentColor">
            <rect x="2" y="1" width="36" height="2.5" />
            <rect x="2" y="3.5" width="3.5" height="5" />
          </svg>
        );
      case '相':
      case '象':
        return (
          <svg viewBox="0 0 40 10" className={commonClass} fill="currentColor">
            <rect x="2" y="1" width="36" height="2" />
            <path d="M 2 3 L 13 3 L 2 9 L 2 3 Z" />
          </svg>
        );
      case '俥':
      case '車':
        return (
          <svg viewBox="0 0 40 10" className={commonClass} fill="currentColor">
            <rect x="2" y="1" width="36" height="2" />
            <rect x="18" y="3" width="4" height="5.5" />
          </svg>
        );
      case '傌':
      case '馬':
        return (
          <svg viewBox="0 0 40 10" className={commonClass} fill="currentColor">
            <circle cx="11" cy="4.5" r="2.5" />
            <circle cx="29" cy="4.5" r="2.5" />
          </svg>
        );
      case '炮':
      case '包':
        return (
          <svg viewBox="0 0 40 11" className={commonClass} fill="currentColor">
            <rect x="2" y="1" width="36" height="2" />
            <rect x="2" y="4.5" width="36" height="1.5" />
            <rect x="2" y="7.5" width="12" height="2.5" />
          </svg>
        );
      case '兵':
      case '卒':
        return (
          <svg viewBox="0 0 40 12" className={commonClass} fill="currentColor">
            <path d="M 8 1 L 12 1 L 4 11 L 0 11 Z" />
            <path d="M 20 1 L 24 1 L 16 11 L 12 11 Z" />
            <path d="M 32 1 L 36 1 L 28 11 L 24 11 Z" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 40 10" className={commonClass} fill="currentColor">
            <rect x="2" y="4" width="36" height="2" />
          </svg>
        );
    }
  };

  if (!isRevealed) {
    // Face-down card: Classic traditional red-pattern back
    return (
      <div
        className={`relative rounded flex flex-col items-center justify-center select-none shadow-md border-2 border-amber-950 bg-red-800 ${
          sizeClasses[size]
        }`}
        style={{
          backgroundImage:
            'radial-gradient(circle, #7f1d1d 10%, transparent 11%), radial-gradient(circle, #7f1d1d 10%, transparent 11%)',
          backgroundSize: '8px 8px',
          backgroundPosition: '0 0, 4px 4px',
        }}
      >
        <div className="absolute inset-1 border border-amber-500/40 rounded flex flex-col items-center justify-center">
          <span className="text-amber-400/80 font-serif font-bold text-xs tracking-widest writing-mode-vertical">
            四色牌
          </span>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={!disabled && onClick ? onClick : undefined}
      disabled={disabled}
      className={`relative rounded flex flex-col items-center justify-between pt-1.5 pb-2 font-serif select-none transition-all shadow border border-black/15 ${
        theme.bg
      } ${sizeClasses[size]} ${
        disabled ? 'opacity-85 cursor-not-allowed' : 'cursor-pointer hover:scale-105 active:scale-95'
      } ${
        isSelected ? 'ring-4 ring-cyan-400 scale-105 -translate-y-2' : ''
      }`}
    >
      {/* Outer black/red frame matching traditional woodblock designs */}
      <div className={`absolute inset-[1.5px] md:inset-[2.5px] border-[2px] md:border-[3px] border-solid rounded-xs opacity-95 pointer-events-none ${theme.border}`} />

      {/* Top Character and Decoration */}
      <div className={`z-10 flex flex-col items-center w-full px-1 ${theme.text}`}>
        {getDecoration(card.character)}
        <span className={`font-black font-serif leading-none mt-1 ${fontSizeClasses[size]} tracking-tight text-center select-none`}>
          {card.character}
        </span>
      </div>

      {/* Central Symbolic Badge (e.g. four dots for horse, coin for general) */}
      <div className="z-10 flex-grow flex items-center justify-center w-full">
        {getCenterDecoration()}
      </div>

      {/* Bottom Character and Decoration (Upside right-side characters on both sides is traditional) */}
      <div className={`z-10 flex flex-col items-center rotate-180 w-full px-1 ${theme.text}`}>
        {getDecoration(card.character)}
        <span className={`font-black font-serif leading-none mt-1 ${fontSizeClasses[size]} tracking-tight text-center select-none`}>
          {card.character}
        </span>
      </div>
    </button>
  );
};
