import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useServiceDetails, useDeleteService } from '../hooks/queries';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EditServiceModal } from '../components/services/EditServiceModal';
import { Trash2, Edit2, ServerCrash, ShieldCheck, ChevronRight } from 'lucide-react';

function getStatusBadge(status: string) {
  switch (status) {
    case 'OPERATIONAL': return <Badge variant="success">Operational</Badge>;
    case 'DEGRADED': return <Badge variant="warning">Degraded</Badge>;
    case 'PARTIAL_OUTAGE': return <Badge variant="danger">Partial Outage</Badge>;
    case 'MAJOR_OUTAGE': return <Badge variant="danger">Major Outage</Badge>;
    default: return <Badge variant="default">Unknown</Badge>;
  }
}

function getSeverityBadge(sev: string) {
  switch (sev) {
    case 'CRITICAL': return <Badge variant="danger">Critical</Badge>;
    case 'HIGH': return <Badge variant="warning">High</Badge>;
    case 'MEDIUM': return <Badge variant="info">Medium</Badge>;
    default: return <Badge variant="default">Low</Badge>;
  }
}

function ServiceDetailsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-48" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function ServiceDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const { data: service, isLoading, isError, refetch } = useServiceDetails(id!);
  const { mutateAsync: deleteService, isPending: isDeleting } = useDeleteService();

  if (isLoading) return <ServiceDetailsSkeleton />;

  if (isError) {
    return (
      <Card>
        <EmptyState
          icon={ServerCrash}
          title="Failed to load service"
          description="Something went wrong while fetching this service. Please try again."
          action={<Button variant="secondary" onClick={() => refetch()}>Retry</Button>}
        />
      </Card>
    );
  }

  if (!service) {
    return (
      <Card>
        <EmptyState icon={ServerCrash} title="Service not found" description="This service may have been removed." />
      </Card>
    );
  }

  const handleDelete = async () => {
    try {
      await deleteService(service.id);
      navigate('/services');
    } catch (err) {
      console.error(err);
    }
  };

  const activeIncidents = service.incidents?.filter((i: any) => i.status !== 'RESOLVED' && i.status !== 'CLOSED') ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">{service.name}</h1>
            {getStatusBadge(service.status)}
          </div>
          <p className="text-gray-400">{service.description}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" onClick={() => setIsEditOpen(true)}>
            <Edit2 className="h-4 w-4" aria-hidden="true" />
            Edit Service
          </Button>
          <Button variant="danger" onClick={() => setIsConfirmDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete Service
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Active Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            {activeIncidents.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No active incidents"
                description="This service isn't affected by any ongoing incident."
                className="py-6"
              />
            ) : (
              <ul className="space-y-3">
                {activeIncidents.map((incident: any) => (
                  <li key={incident.id}>
                    <Link
                      to={`/incidents/${incident.id}`}
                      className="flex justify-between items-center gap-3 p-3 rounded-lg border border-border bg-background/40 hover:border-border-hover hover:bg-surface-hover transition-colors"
                    >
                      <span className="font-medium text-white truncate">{incident.title}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {getSeverityBadge(incident.severity)}
                        <ChevronRight className="h-4 w-4 text-gray-600" aria-hidden="true" />
                      </div>
                    </Link>
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
              <span className="text-white font-mono text-xs break-all">{service.id}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <EditServiceModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        service={service}
      />

      <ConfirmDialog
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete this service?"
        description={`"${service.name}" will be permanently removed. This action cannot be undone.`}
        confirmLabel="Delete Service"
        isLoading={isDeleting}
      />
    </div>
  );
}
