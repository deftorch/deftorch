'use client';

import React from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'icon' | 'full';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  variant = 'full',
  className 
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Logo Icon */}
      <div className={cn(
        sizeClasses[size],
        'rounded-xl bg-gradient-to-br from-primary via-primary/90 to-primary/70',
        'flex items-center justify-center relative overflow-hidden',
        'shadow-lg shadow-primary/20'
      )}>
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent animate-shimmer" />
        
        {/* Icon */}
        <Bot className={cn(iconSizes[size], 'text-primary-foreground relative z-10')} />
        
        {/* Sparkle accent */}
        <Sparkles className={cn(
          'absolute top-1 right-1 text-yellow-300',
          size === 'sm' ? 'h-2 w-2' : size === 'md' ? 'h-2.5 w-2.5' : 'h-3 w-3'
        )} />
      </div>

      {/* Logo Text */}
      {variant === 'full' && (
        <div className="flex flex-col">
          <span className={cn(
            textSizes[size],
            'font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent'
          )}>
            AI Vision
          </span>
          <span className={cn(
            size === 'sm' ? 'text-[10px]' : 'text-xs',
            'text-muted-foreground -mt-1'
          )}>
            Powered by JOSSKI
          </span>
        </div>
      )}
    </div>
  );
};
