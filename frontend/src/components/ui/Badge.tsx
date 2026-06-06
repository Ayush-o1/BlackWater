import { forwardRef } from "react";
import type { HTMLAttributes } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
          {
            'bg-gray-800 text-gray-100': variant === 'default',
            'bg-green-500/10 text-green-400': variant === 'success',
            'bg-yellow-500/10 text-yellow-400': variant === 'warning',
            'bg-red-500/10 text-red-400': variant === 'danger',
            'bg-blue-500/10 text-blue-400': variant === 'info',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = 'Badge';
