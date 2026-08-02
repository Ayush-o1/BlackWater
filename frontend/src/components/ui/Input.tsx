import { forwardRef, useId, useState } from "react";
import type { InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, type, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const isPassword = type === 'password';
    const [revealed, setRevealed] = useState(false);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-300">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={isPassword && revealed ? 'text' : type}
            aria-invalid={!!error}
            aria-describedby={errorId}
            className={cn(
              'flex h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-white placeholder:text-gray-500 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
              isPassword && 'pr-10',
              error && 'border-red-500 focus-visible:ring-red-500',
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-300 transition-colors focus-visible:outline-none focus-visible:text-primary"
            >
              {revealed ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          )}
        </div>
        {error && <span id={errorId} className="text-xs text-red-400 mt-1">{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';
