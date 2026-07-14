'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  showValue?: boolean;
  step?: number;
}

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, label, showValue = true, step = 0.1, ...props }, ref) => {
    const [value, setValue] = React.useState(props.value || props.defaultValue || 0);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value);
      props.onChange?.(e);
    };

    return (
      <div className={cn('space-y-2', className)}>
        {label && (
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">{label}</label>
            {showValue && <span className="text-sm text-muted-foreground">{value}</span>}
          </div>
        )}
        <input
          ref={ref}
          type="range"
          step={step}
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
          value={value}
          onChange={handleChange}
          {...props}
        />
      </div>
    );
  }
);

Slider.displayName = 'Slider';
