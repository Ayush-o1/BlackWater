import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Avatar } from '../components/ui/Avatar';
import { useIncidents } from '../hooks/queries';
import { CreateIncidentModal } from '../components/incidents/CreateIncidentModal';
import { PlusCircle, AlertTriangle, ChevronRight } from 'lucide-react';

function getSeverityBadge(sev: string) {
  switch (sev) {
    case 'CRITICAL': return <Badge variant="danger">Critical</Badge>;
    case 'HIGH': return <Badge variant="warning">High</Badge>;
    case 'MEDIUM': return <Badge variant="info">Medium</Badge>;
    default: return <Badge variant="default">Low</Badge>;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'RESOLVED': return <Badge variant="success">Resolved</Badge>;
    case 'CLOSED': return <Badge variant="default">Closed</Badge>;
    case 'ACKNOWLEDGED': return <Badge variant="warning">Acknowledged</Badge>;
    default: return <Badge variant="danger">Triggered</Badge>;
  }
}

export function Incidents() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data, isLoading } = useIncidents({ limit: 50 });
  const incidents = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Incidents</h1>
          <p className="text-gray-400 mt-2">Manage and track active platform incidents.</p>
        </div>
        <Button variant="primary" onClick={() => setIsCreateOpen(true)} className="shrink-0">
          <PlusCircle className="h-4 w-4" aria-hidden="true" />
          Declare Incident
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="No incidents found"
            description="When an incident is declared, it will show up here for your team to triage."
            action={<Button variant="secondary" onClick={() => setIsCreateOpen(true)}>Declare First Incident</Button>}
          />
        </Card>
      ) : (
        <>
          {/* Desktop / tablet table */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((incident: any) => (
                  <TableRow key={incident.id} className="relative">
                    <TableCell className="font-medium text-white">
                      <Link
                        to={`/incidents/${incident.id}`}
                        className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                      >
                        <span className="sr-only">View incident</span>
                      </Link>
                      <span aria-hidden="true">{incident.title}</span>
                    </TableCell>
                    <TableCell>{getStatusBadge(incident.status)}</TableCell>
                    <TableCell>{getSeverityBadge(incident.severity)}</TableCell>
                    <TableCell>
                      {incident.assignee ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={incident.assignee.name} size="sm" className="h-6 w-6 text-[10px]" />
                          <span>{incident.assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-gray-500">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>{new Date(incident.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden space-y-3">
            {incidents.map((incident: any) => (
              <Link key={incident.id} to={`/incidents/${incident.id}`}>
                <Card interactive>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-white leading-snug">{incident.title}</p>
                      <ChevronRight className="h-4 w-4 text-gray-600 shrink-0 mt-0.5" aria-hidden="true" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {getStatusBadge(incident.status)}
                      {getSeverityBadge(incident.severity)}
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      {incident.assignee?.name || 'Unassigned'} · {new Date(incident.createdAt).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}

      <CreateIncidentModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
}
