import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useServices } from '../hooks/queries';
import { CreateServiceModal } from '../components/services/CreateServiceModal';
import { PlusCircle, Server, ChevronRight } from 'lucide-react';

function getStatusBadge(status: string) {
  switch (status) {
    case 'OPERATIONAL': return <Badge variant="success">Operational</Badge>;
    case 'DEGRADED': return <Badge variant="warning">Degraded</Badge>;
    case 'PARTIAL_OUTAGE': return <Badge variant="danger">Partial Outage</Badge>;
    case 'MAJOR_OUTAGE': return <Badge variant="danger">Major Outage</Badge>;
    default: return <Badge variant="default">Unknown</Badge>;
  }
}

export function Services() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data, isLoading } = useServices();
  const services = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Services</h1>
          <p className="text-gray-400 mt-2">Manage your platform components and view their health.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="shrink-0">
          <PlusCircle className="h-4 w-4" aria-hidden="true" />
          Add Service
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <Card>
          <EmptyState
            icon={Server}
            title="No services tracked yet"
            description="Add the components of your platform to start monitoring their health."
            action={<Button variant="secondary" onClick={() => setIsCreateOpen(true)}>Create First Service</Button>}
          />
        </Card>
      ) : (
        <>
          {/* Desktop / tablet table */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Current Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service: any) => (
                  <TableRow key={service.id} className="relative">
                    <TableCell className="font-medium text-white">
                      <Link
                        to={`/services/${service.id}`}
                        className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                      >
                        <span className="sr-only">View service</span>
                      </Link>
                      <span aria-hidden="true">{service.name}</span>
                    </TableCell>
                    <TableCell className="max-w-md truncate">{service.description || '—'}</TableCell>
                    <TableCell>{getStatusBadge(service.status)}</TableCell>
                    <TableCell>{new Date(service.updatedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden space-y-3">
            {services.map((service: any) => (
              <Link key={service.id} to={`/services/${service.id}`}>
                <Card className="hover:border-border-hover hover:bg-surface-hover">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-white">{service.name}</p>
                        {service.description && (
                          <p className="text-sm text-gray-500 mt-0.5 truncate">{service.description}</p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-600 shrink-0 mt-0.5" aria-hidden="true" />
                    </div>
                    <div className="mt-3">{getStatusBadge(service.status)}</div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}

      <CreateServiceModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
}
