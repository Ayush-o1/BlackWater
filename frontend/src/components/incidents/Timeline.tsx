import { PlusCircle, ArrowRightLeft, UserCheck, MessageSquarePlus, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface TimelineEvent {
  id?: string;
  eventType: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

interface TimelineProps {
  events: TimelineEvent[];
}

function humanizeStatus(status: unknown) {
  if (typeof status !== 'string') return null;
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function describeEvent(event: TimelineEvent): { icon: LucideIcon; label: string; detail: string | null } {
  const metadata = event.metadata ?? {};

  switch (event.eventType) {
    case 'INCIDENT_CREATED':
    case 'CREATED':
      return {
        icon: PlusCircle,
        label: 'Incident created',
        detail: typeof metadata.severity === 'string' ? `Severity: ${humanizeStatus(metadata.severity)}` : null,
      };
    case 'STATUS_CHANGED':
    case 'STATUS_CHANGE': {
      const oldStatus = humanizeStatus(metadata.oldStatus);
      const newStatus = humanizeStatus(metadata.newStatus ?? metadata.status);
      return {
        icon: ArrowRightLeft,
        label: 'Status changed',
        detail: oldStatus && newStatus ? `${oldStatus} → ${newStatus}` : newStatus ? `Now ${newStatus}` : null,
      };
    }
    case 'ASSIGNEE_CHANGED':
    case 'ASSIGNED':
      return { icon: UserCheck, label: 'Assignee updated', detail: null };
    case 'UPDATE_ADDED':
      return {
        icon: MessageSquarePlus,
        label: 'Update posted',
        detail: metadata.isPublic ? 'Visible on public status page' : 'Internal note',
      };
    default:
      return { icon: Clock, label: event.eventType.replace(/_/g, ' ').toLowerCase(), detail: null };
  }
}

export function Timeline({ events }: TimelineProps) {
  if (!events || events.length === 0) {
    return <p className="text-gray-500 text-sm italic">No timeline events recorded yet.</p>;
  }

  return (
    <ol className="relative border-l border-border ml-3 space-y-6">
      {events.map((event, i) => {
        const { icon: Icon, label, detail } = describeEvent(event);
        return (
          <li key={event.id || i} className="relative pl-6">
            <span className="absolute -left-[15px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-surface border border-border">
              <Icon className="h-3 w-3 text-gray-400" aria-hidden="true" />
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-medium text-gray-200 capitalize">{label}</p>
              <time className="text-xs text-gray-500" dateTime={event.createdAt}>
                {new Date(event.createdAt).toLocaleString()}
              </time>
            </div>
            {detail && <p className="text-sm text-gray-500 mt-0.5">{detail}</p>}
          </li>
        );
      })}
    </ol>
  );
}
