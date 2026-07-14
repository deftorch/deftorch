'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'rectangular',
  ...props
}) => {
  return (
    <div
      className={cn(
        'animate-pulse bg-muted',
        variant === 'text' && 'h-4 rounded',
        variant === 'circular' && 'rounded-full',
        variant === 'rectangular' && 'rounded-lg',
        className
      )}
      {...props}
    />
  );
};

export const ChatMessageSkeleton: React.FC = () => {
  return (
    <div className="flex gap-4 px-4 py-6">
      <Skeleton variant="circular" className="h-8 w-8 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="w-20" />
        <Skeleton variant="text" className="w-full" />
        <Skeleton variant="text" className="w-3/4" />
      </div>
    </div>
  );
};

export const SidebarSkeleton: React.FC = () => {
  return (
    <div className="p-2 space-y-1">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <Skeleton variant="circular" className="h-4 w-4 shrink-0" />
          <div className="flex-1 space-y-1">
            <Skeleton variant="text" className="w-full" />
            <Skeleton variant="text" className="w-20 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
};
