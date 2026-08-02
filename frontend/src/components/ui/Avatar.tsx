import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// A small, fixed palette rather than arbitrary hues — enough to tell people
// apart at a glance without turning the UI colorful for its own sake.
const PALETTE = [
  'bg-blue-500/20 text-blue-300',
  'bg-violet-500/20 text-violet-300',
  'bg-teal-500/20 text-teal-300',
  'bg-amber-500/20 text-amber-300',
  'bg-rose-500/20 text-rose-300',
  'bg-emerald-500/20 text-emerald-300',
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function paletteIndexFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % PALETTE.length;
}

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-14 w-14 text-lg',
};

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex items-center justify-center rounded-full font-semibold shrink-0 select-none',
        SIZE_CLASSES[size],
        PALETTE[paletteIndexFor(name || '?')],
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}
