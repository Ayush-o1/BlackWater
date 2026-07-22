import { useParams, Link } from 'react-router-dom';
import { useStatusOverview } from '../../hooks/queries';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { CheckCircle, AlertTriangle, Activity, SearchX } from 'lucide-react';

const statusDot: Record<string, string> = {
  OPERATIONAL: 'bg-green-400',
  DEGRADED: 'bg-yellow-400',
  PARTIAL_OUTAGE: 'bg-orange-400',
  MAJOR_OUTAGE: 'bg-red-400',
};

function StatusOverviewSkeleton() {
  return (
    <div className="space-y-12">
      <div className="text-center space-y-3">
        <Skeleton className="h-8 w-64 mx-auto" />
        <Skeleton className="h-4 w-80 mx-auto" />
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function StatusOverview() {
  const { orgId } = useParams<{ orgId: string }>();
  const { data, isLoading } = useStatusOverview(orgId!);

  if (isLoading) return <StatusOverviewSkeleton />;
  if (!data) {
    return (
      <Card>
        <EmptyState icon={SearchX} title="Organization not found" description="This status page doesn't exist or is no longer available." />
      </Card>
    );
  }

  const { organization, overallStatus, services, activeIncidents } = data;

  const renderHeroBanner = () => {
    switch (overallStatus) {
      case 'OPERATIONAL':
        return (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-8 flex flex-col items-center justify-center text-center">
            <CheckCircle className="h-12 w-12 text-green-400 mb-4" aria-hidden="true" />
            <h2 className="text-2xl font-bold text-green-400">All Systems Operational</h2>
            <p className="text-green-500/80 mt-2">No active incidents are currently affecting {organization.name}.</p>
          </div>
        );
      case 'MAJOR_OUTAGE':
        return (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 flex flex-col items-center justify-center text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mb-4" aria-hidden="true" />
            <h2 className="text-2xl font-bold text-red-500">Major Outage</h2>
            <p className="text-red-500/80 mt-2">We are currently experiencing a widespread outage across {organization.name}.</p>
          </div>
        );
      default:
        return (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-8 flex flex-col items-center justify-center text-center">
            <Activity className="h-12 w-12 text-yellow-400 mb-4" aria-hidden="true" />
            <h2 className="text-2xl font-bold text-yellow-400">Degraded Performance</h2>
            <p className="text-yellow-500/80 mt-2">Some services are experiencing partial outages or degraded performance.</p>
          </div>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPERATIONAL': return <Badge variant="success">Operational</Badge>;
      case 'DEGRADED': return <Badge variant="warning">Degraded</Badge>;
      case 'PARTIAL_OUTAGE': return <Badge variant="danger">Partial Outage</Badge>;
      case 'MAJOR_OUTAGE': return <Badge variant="danger">Major Outage</Badge>;
      default: return <Badge variant="default">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-12">
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{organization.name} Status</h1>
        <p className="text-gray-400">Real-time status tracking and incident history</p>
      </div>

      {renderHeroBanner()}

      {activeIncidents?.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-white">Active Incidents</h3>
          <div className="space-y-4">
            {activeIncidents.map((incident: any) => (
              <Link key={incident.id} to={`/status/${orgId}/incidents/${incident.id}`} className="block">
                <Card className="hover:border-border-hover hover:bg-surface-hover border-l-4 border-l-warning">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <h4 className="text-lg font-bold text-white truncate">{incident.title}</h4>
                        <p className="text-gray-400 text-sm mt-1">Started {new Date(incident.createdAt).toLocaleString()}</p>
                      </div>
                      <Badge variant={incident.severity === 'CRITICAL' ? 'danger' : 'warning'} className="shrink-0">{incident.severity}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-xl font-bold text-white">System Metrics</h3>
        <Card>
          <div className="divide-y divide-border">
            {services.map((service: any) => (
              <div key={service.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[service.status] ?? 'bg-gray-400'}`} aria-hidden="true" />
                  <div className="min-w-0">
                    <span className="font-medium text-white block truncate">{service.name}</span>
                    {service.description && <span className="block text-sm text-gray-500 mt-0.5 truncate">{service.description}</span>}
                  </div>
                </div>
                <div className="shrink-0">{getStatusBadge(service.status)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
