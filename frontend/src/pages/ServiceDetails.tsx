import { useParams, useNavigate } from 'react-router-dom';
import { useServiceDetails, useDeleteService } from '../hooks/queries';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Trash2 } from 'lucide-react';

export function ServiceDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: service, isLoading } = useServiceDetails(id!);
  const { mutateAsync: deleteService, isPending: isDeleting } = useDeleteService();

  if (isLoading) return <div className="text-white">Loading...</div>;
  if (!service) return <div className="text-white">Service not found.</div>;

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;
    try {
      await deleteService(service.id);
      navigate('/services');
    } catch (err) {
      console.error(err);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight text-white">{service.name}</h1>
            {getStatusBadge(service.status)}
          </div>
          <p className="text-gray-400">{service.description}</p>
        </div>
        <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Service
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Active Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            {service.incidents?.filter((i: any) => i.status !== 'RESOLVED' && i.status !== 'CLOSED').length === 0 ? (
              <p className="text-gray-500">No active incidents affecting this service.</p>
            ) : (
              <ul className="space-y-3">
                {service.incidents?.filter((i: any) => i.status !== 'RESOLVED' && i.status !== 'CLOSED').map((incident: any) => (
                  <li key={incident.id} className="flex justify-between items-center p-3 rounded-lg border border-border bg-surface/50">
                    <span className="font-medium text-white">{incident.title}</span>
                    <Badge variant="warning">Ongoing</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="block text-gray-500 text-sm mb-1">Created At</span>
              <span className="text-white">{new Date(service.createdAt).toLocaleString()}</span>
            </div>
            <div>
              <span className="block text-gray-500 text-sm mb-1">Last Updated At</span>
              <span className="text-white">{new Date(service.updatedAt).toLocaleString()}</span>
            </div>
            <div>
              <span className="block text-gray-500 text-sm mb-1">Service ID</span>
              <span className="text-white font-mono text-xs">{service.id}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
