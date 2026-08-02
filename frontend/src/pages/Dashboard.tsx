import { Link } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/Card';
import { useIncidents, useServices } from '../hooks/queries';
import { Badge } from '../components/ui/Badge';
import { StatCard } from '../components/ui/StatCard';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { Activity, Server, AlertTriangle, CheckCircle, PartyPopper, ChevronRight } from 'lucide-react';

export function Dashboard() {
  const { data: servicesData, isLoading: isLoadingServices } = useServices();
  const { data: incidentsData, isLoading: isLoadingIncidents } = useIncidents({ limit: 100 });
  const isLoading = isLoadingServices || isLoadingIncidents;

  const totalServices = (Array.isArray(servicesData) ? servicesData : [])?.length || 0;

  const activeIncidents = (Array.isArray(incidentsData) ? incidentsData : [])?.filter(
    (i: any) => i.status !== 'RESOLVED' && i.status !== 'CLOSED'
  ) || [];

  const criticalIncidents = activeIncidents.filter((i: any) => i.severity === 'CRITICAL').length;

  const getSystemStatus = () => {
    if (isLoading) return { label: 'Loading…', color: 'text-gray-400', icon: Activity };
    if (activeIncidents.length === 0) return { label: 'All Systems Operational', color: 'text-green-400', icon: CheckCircle };
    if (criticalIncidents > 0) return { label: 'Major Outage Active', color: 'text-red-500', icon: AlertTriangle };
    return { label: 'Degraded Performance', color: 'text-yellow-400', icon: Activity };
  };

  const status = getSystemStatus();
  const StatusIcon = status.icon;

  const severityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL': return <Badge variant="danger">Critical</Badge>;
      case 'HIGH': return <Badge variant="warning">High</Badge>;
      case 'MEDIUM': return <Badge variant="info">Medium</Badge>;
      default: return <Badge variant="default">Low</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Dashboard</h1>
        <p className="text-gray-400 mt-2">Overview of your system health and recent incidents.</p>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="System Status"
          value={status.label}
          icon={StatusIcon}
          iconClassName={`bg-muted ${status.color}`}
          valueClassName={`text-base leading-snug ${status.color}`}
          isLoading={isLoading}
        />

        <StatCard
          label="Active Incidents"
          value={activeIncidents.length}
          icon={Activity}
          iconClassName="text-primary bg-primary/10"
          isLoading={isLoading}
        />
        <StatCard
          label="Critical Incidents"
          value={criticalIncidents}
          icon={AlertTriangle}
          iconClassName="text-red-400 bg-red-500/10"
          isLoading={isLoading}
        />
        <StatCard
          label="Total Services"
          value={totalServices}
          icon={Server}
          iconClassName="text-gray-300 bg-muted"
          isLoading={isLoading}
        />
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold text-white mb-4">Recent Active Incidents</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
            ))}
          </div>
        ) : activeIncidents.length === 0 ? (
          <Card className="border-dashed">
            <EmptyState
              icon={PartyPopper}
              title="No active incidents"
              description="Everything is running smoothly. New incidents will show up here."
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {activeIncidents.slice(0, 5).map((incident: any) => (
              <Link key={incident.id} to={`/incidents/${incident.id}`}>
                <Card interactive>
                  <CardContent className="p-4 flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {incident.assignee && <Avatar name={incident.assignee.name} size="sm" />}
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white truncate">{incident.title}</h3>
                        <p className="text-sm text-gray-400 mt-1">
                          {incident.assignee ? `${incident.assignee.name} · ` : ''}
                          Started {new Date(incident.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {severityBadge(incident.severity)}
                      <ChevronRight className="h-4 w-4 text-gray-600" aria-hidden="true" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
