import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { Card } from '../ui/Card';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Ambient background: a soft glow anchored above the card and a faint
          dot grid fading out toward the edges — depth without motion. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/10 blur-[110px]" />
        <div
          className="absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_55%_45%_at_50%_0%,black,transparent)]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      <div className="relative w-full max-w-[400px]">
        <div className="flex flex-col items-center text-center mb-8 animate-fade-in">
          <Link to="/" className="group flex items-center gap-2.5 mb-8" tabIndex={-1}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/30 transition-transform duration-150 group-hover:scale-105">
              <Activity className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <span className="text-base font-semibold tracking-tight text-white">BlackWater</span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
          <p className="text-sm text-gray-400 mt-2">{subtitle}</p>
        </div>

        <Card className="bg-surface-elevated p-6 sm:p-8 shadow-xl shadow-black/40 animate-scale-in">
          {children}
        </Card>

        <p className="text-center text-sm text-gray-400 mt-6 animate-fade-in">{footer}</p>
      </div>
    </div>
  );
}
