import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useIncidents, useServices } from '../hooks/queries';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { StatCard } from '../components/ui/StatCard';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import {
  CheckCircle,
  AlertTriangle,
  Activity,
  Server,
  ExternalLink,
  Copy,
  Globe,
  ArrowUpRight,
} from 'lucide-react';

const statusDot: Record<string, string> = {
  OPERATIONAL: 'bg-green-400',
  DEGRADED: 'bg-yellow-400',
  PARTIAL_OUTAGE: 'bg-orange-400',
  MAJOR_OUTAGE: 'bg-red-400',
};

const statusLabel: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }> = {
  OPERATIONAL: { label: 'Operational', variant: 'success' },
  DEGRADED: { label: 'Degraded', variant: 'warning' },
  PARTIAL_OUTAGE: { label: 'Partial Outage', variant: 'danger' },
  MAJOR_OUTAGE: { label: 'Major Outage', variant: 'danger' },
};

export function AdminStatusPage() {
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);

  const { data: servicesData, isLoading: loadingServices } = useServices();
  const { data: incidentsData, isLoading: loadingIncidents } = useIncidents({ limit: 100 });

  const orgId = user?.orgId ?? '';
  const publicUrl = `${window.location.origin}/status/${orgId}`;

  const services = Array.isArray(servicesData) ? servicesData : [];
  const allIncidents = Array.isArray(incidentsData) ? incidentsData : [];
  const activeIncidents = allIncidents.filter(
    (i: any) => i.status !== 'RESOLVED' && i.status !== 'CLOSED'
  );
  const criticalCount = activeIncidents.filter((i: any) => i.severity === 'CRITICAL').length;
  const operationalCount = services.filter((s: any) => s.status === 'OPERATIONAL').length;

  const getOverallStatus = () => {
    if (loadingServices || loadingIncidents) return { label: 'Loading…', color: 'text-gray-400', icon: Activity, bg: 'bg-gray-500/10 border-gray-500/20' };
    if (criticalCount > 0) return { label: 'Major Outage', color: 'text-red-500', icon: AlertTriangle, bg: 'bg-red-500/10 border-red-500/20' };
    if (activeIncidents.length > 0) return { label: 'Degraded Performance', color: 'text-yellow-400', icon: Activity, bg: 'bg-yellow-500/10 border-yellow-500/20' };
    return { label: 'All Systems Operational', color: 'text-green-400', icon: CheckCircle, bg: 'bg-green-500/10 border-green-500/20' };
  };

  const overall = getOverallStatus();
  const OverallIcon = overall.icon;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Status Page</h1>
          <p className="text-gray-400 mt-2">
            Monitor your public status page and overall system health.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => window.open(publicUrl, '_blank')}
          className="shrink-0"
        >
          <Globe className="h-4 w-4" aria-hidden="true" />
          View Public Page
          <ExternalLink className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
        </Button>
      </div>

      {/* Overall Status Banner */}
      <div className={`rounded-xl border p-6 flex items-center gap-4 ${overall.bg}`}>
        <OverallIcon className={`h-8 w-8 shrink-0 ${overall.color}`} aria-hidden="true" />
        <div>
          <p className={`text-xl font-bold ${overall.color}`}>{overall.label}</p>
          <p className="text-sm text-gray-400 mt-0.5">
            {operationalCount} of {services.length} services operational
            {activeIncidents.length > 0 && ` · ${activeIncidents.length} active incident${activeIncidents.length > 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Incidents"
          value={activeIncidents.length}
          icon={AlertTriangle}
          iconClassName="text-yellow-400 bg-yellow-500/10"
          isLoading={loadingIncidents}
        />
        <StatCard
          label="Critical"
          value={criticalCount}
          icon={AlertTriangle}
          iconClassName="text-red-400 bg-red-500/10"
          isLoading={loadingIncidents}
        />
        <StatCard
          label="Total Services"
          value={services.length}
          icon={Server}
          iconClassName="text-gray-300 bg-muted"
          isLoading={loadingServices}
        />
        <StatCard
          label="Operational"
          value={operationalCount}
          icon={CheckCircle}
          iconClassName="text-green-400 bg-green-500/10"
          isLoading={loadingServices}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Service Health */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Service Health</CardTitle>
            <Link to="/services" className="text-xs text-gray-500 hover:text-primary transition-colors flex items-center gap-1">
              Manage <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </CardHeader>
          <div className="divide-y divide-border">
            {loadingServices ? (
              <div className="p-6 space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : services.length === 0 ? (
              <EmptyState icon={Server} title="No services configured" className="py-8" />
            ) : (
              services.map((service: any) => {
                const dot = statusDot[service.status] ?? 'bg-gray-400';
                const lbl = statusLabel[service.status] ?? { label: service.status, variant: 'default' as const };
                return (
                  <div key={service.id} className="px-6 py-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{service.name}</p>
                        {service.description && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{service.description}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant={lbl.variant} className="shrink-0">{lbl.label}</Badge>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Right column: Active Incidents + Public URL */}
        <div className="flex flex-col gap-6">
          {/* Active Incidents */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Active Incidents</CardTitle>
              <Link to="/incidents" className="text-xs text-gray-500 hover:text-primary transition-colors flex items-center gap-1">
                View all <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </CardHeader>
            <div className="divide-y divide-border">
              {loadingIncidents ? (
                <div className="p-6 space-y-3">
                  {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : activeIncidents.length === 0 ? (
                <EmptyState icon={CheckCircle} title="No active incidents" className="py-8" />
              ) : (
                activeIncidents.slice(0, 4).map((incident: any) => (
                  <Link
                    key={incident.id}
                    to={`/incidents/${incident.id}`}
                    className="block px-6 py-3.5 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-white leading-snug">{incident.title}</p>
                      <Badge
                        variant={
                          incident.severity === 'CRITICAL'
                            ? 'danger'
                            : incident.severity === 'HIGH'
                            ? 'warning'
                            : 'default'
                        }
                        className="shrink-0"
                      >
                        {incident.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {incident.status} · Started {new Date(incident.createdAt).toLocaleString()}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </Card>

          {/* Public Status URL */}
          <Card>
            <CardHeader>
              <CardTitle>Public Status URL</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-400">
                Share this URL with your customers so they can track system status in real-time.
              </p>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-background border border-border font-mono text-xs text-gray-300 break-all">
                {publicUrl}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={handleCopy}
                  className="flex-1"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  {copied ? 'Copied!' : 'Copy URL'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => window.open(publicUrl, '_blank')}
                  className="flex-1"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Open Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
