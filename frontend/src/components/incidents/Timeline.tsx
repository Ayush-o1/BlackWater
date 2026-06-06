import { Clock } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface TimelineProps {
  events: any[];
}

export function Timeline({ events }: TimelineProps) {
  if (!events || events.length === 0) {
    return <div className="text-gray-500 text-sm italic">No timeline events recorded yet.</div>;
  }

  const formatEventType = (type: string) => {
    return type.replace(/_/g, ' ');
  };

  return (
    <div className="relative border-l border-border ml-3 space-y-6 pb-4">
      {events.map((event, i) => (
        <div key={event.id || i} className="relative pl-6">
          {/* Timeline Dot */}
          <span className="absolute -left-2.5 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface border border-border">
            <Clock className="h-3 w-3 text-gray-400" />
          </span>

          <Card className="bg-surface/50">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <Badge variant="default" className="text-[10px] uppercase tracking-wider">
                  {formatEventType(event.eventType)}
                </Badge>
                <span className="text-xs text-gray-500">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </div>
              
              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <div className="mt-3 text-sm text-gray-300 bg-black/20 p-3 rounded border border-border/50 font-mono text-xs overflow-x-auto">
                  <pre>{JSON.stringify(event.metadata, null, 2)}</pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
