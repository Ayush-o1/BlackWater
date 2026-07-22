import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from './Card';
import { Skeleton } from './Skeleton';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  iconClassName?: string;
  isLoading?: boolean;
}

export function StatCard({ label, value, icon: Icon, iconClassName = 'text-gray-400 bg-muted', isLoading }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-400 truncate">{label}</p>
          {isLoading ? (
            <Skeleton className="h-8 w-14 mt-2" />
          ) : (
            <p className="text-3xl font-bold text-white mt-1 tabular-nums">{value}</p>
          )}
        </div>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${iconClassName}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  );
}
