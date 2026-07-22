import { useParams, Link } from 'react-router-dom';
import { usePublicIncidentDetails } from '../../hooks/queries';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Timeline } from '../../components/incidents/Timeline';
import { ArrowLeft } from 'lucide-react';

export function PublicIncidentDetails() {
  const { orgId, id } = useParams<{ orgId: string, id: string }>();
  const { data: incident, isLoading } = usePublicIncidentDetails(orgId!, id!);

  if (isLoading) return <div className="text-center text-gray-500 py-12">Loading incident details...</div>;
  if (!incident) return <div className="text-center text-red-400 py-12">Incident not found.</div>;

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL': return <Badge variant="danger">Critical</Badge>;
      case 'HIGH': return <Badge variant="warning">High</Badge>;
      case 'MEDIUM': return <Badge variant="info">Medium</Badge>;
      default: return <Badge variant="info">Low</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RESOLVED': return <Badge variant="success">Resolved</Badge>;
      case 'CLOSED': return <Badge variant="default">Closed</Badge>;
      case 'ACKNOWLEDGED': return <Badge variant="warning">Acknowledged</Badge>;
      default: return <Badge variant="danger">Investigating</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Link to={`/status/${orgId}`} className="inline-flex items-center text-sm text-gray-400 hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Status Overview
      </Link>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight text-white">{incident.title}</h1>
            {getStatusBadge(incident.status)}
            {getSeverityBadge(incident.severity)}
          </div>
          <p className="text-gray-400">Incident started on {new Date(incident.createdAt).toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {incident.updates && incident.updates.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white">Updates</h2>
              <div className="space-y-4">
                {/* Updates are pre-filtered to ONLY isPublic:true by the backend! */}
                {incident.updates.map((update: any) => (
                  <Card key={update.id}>
                    <CardContent className="p-4">
                      <p className="text-sm text-gray-500 mb-2">{new Date(update.createdAt).toLocaleString()}</p>
                      <p className="text-white whitespace-pre-wrap">{update.message}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4 pt-6">
            <h2 className="text-xl font-bold text-white">Timeline</h2>
            <Card>
              <CardContent className="p-6">
                <Timeline events={incident.timeline} />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Affected Services</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                {incident.affectedServices?.length > 0 ? (
                  incident.affectedServices.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between">
                      <span className="text-white font-medium">{s.name}</span>
                      <Badge variant="warning">Affected</Badge>
                    </div>
                  ))
                ) : (
                  <span className="text-gray-500 text-sm">No specific services attached.</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
