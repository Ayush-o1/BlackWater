import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useIncidentDetails, useUpdateIncidentStatus, useAddIncidentUpdate, useAssignIncident } from '../hooks/queries';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Textarea } from '../components/ui/Textarea';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Timeline } from '../components/incidents/Timeline';
import { AlertOctagon, MessageSquare } from 'lucide-react';

function getSeverityBadge(sev: string) {
  switch (sev) {
    case 'CRITICAL': return <Badge variant="danger">Critical</Badge>;
    case 'HIGH': return <Badge variant="warning">High</Badge>;
    case 'MEDIUM': return <Badge variant="info">Medium</Badge>;
    default: return <Badge variant="info">Low</Badge>;
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

function IncidentDetailsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function IncidentDetails() {
  const { id } = useParams<{ id: string }>();
  const { data: incident, isLoading, isError, refetch } = useIncidentDetails(id!);
  const { mutate: updateStatus, isPending: isUpdatingStatus } = useUpdateIncidentStatus();
  const { mutate: addUpdate, isPending: isAddingUpdate } = useAddIncidentUpdate();
  const { mutate: assignIncident, isPending: isAssigning } = useAssignIncident();
  const { user } = useAuthStore();

  const [message, setMessage] = useState('');
  const [isPublic, setIsPublic] = useState('false');

  if (isLoading) return <IncidentDetailsSkeleton />;

  if (isError) {
    return (
      <Card>
        <EmptyState
          icon={AlertOctagon}
          title="Failed to load incident"
          description="Something went wrong while fetching this incident. Please try again."
          action={<Button variant="secondary" onClick={() => refetch()}>Retry</Button>}
        />
      </Card>
    );
  }

  if (!incident) {
    return (
      <Card>
        <EmptyState
          icon={AlertOctagon}
          title="Incident not found"
          description="This incident may have been removed, or the link is incorrect."
        />
      </Card>
    );
  }

  const handleStatusChange = (newStatus: string) => {
    updateStatus({ id: incident.id, status: newStatus });
  };

  const handleAssignToMe = () => {
    if (user) {
      assignIncident({ id: incident.id, assigneeId: user.id });
    }
  };

  const handleAddUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    addUpdate(
      { id: incident.id, data: { message, isPublic: isPublic === 'true' } },
      { onSuccess: () => setMessage('') }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">{incident.title}</h1>
            {getStatusBadge(incident.status)}
            {getSeverityBadge(incident.severity)}
          </div>
          <p className="text-gray-400">Created on {new Date(incident.createdAt).toLocaleString()}</p>
        </div>

        <div className="flex gap-2 shrink-0">
          {incident.status === 'TRIGGERED' && (
            <Button variant="secondary" onClick={() => handleStatusChange('ACKNOWLEDGED')} isLoading={isUpdatingStatus}>
              Acknowledge
            </Button>
          )}
          {incident.status === 'ACKNOWLEDGED' && (
            <Button variant="primary" onClick={() => handleStatusChange('RESOLVED')} isLoading={isUpdatingStatus}>
              Resolve Incident
            </Button>
          )}
          {(incident.status === 'RESOLVED' || incident.status === 'CLOSED') && (
            <Button variant="secondary" onClick={() => handleStatusChange('TRIGGERED')} isLoading={isUpdatingStatus}>
              Reopen
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline events={incident.timelineEvents} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add Update</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddUpdate} className="space-y-4">
                <Textarea
                  required
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Provide an update on the investigation..."
                  aria-label="Update message"
                />
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                  <Select
                    className="sm:w-48"
                    value={isPublic}
                    onChange={e => setIsPublic(e.target.value)}
                    aria-label="Update visibility"
                  >
                    <option value="false">Internal Note</option>
                    <option value="true">Public Update</option>
                  </Select>
                  <Button type="submit" isLoading={isAddingUpdate} disabled={!message.trim()}>Post Update</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <span className="text-gray-500 block mb-1">Assignee</span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white font-medium">{incident.assignee?.name || 'Unassigned'}</span>
                  {(!incident.assigneeId || incident.assigneeId !== user?.id) && (
                    <Button
                      variant="secondary"
                      onClick={handleAssignToMe}
                      isLoading={isAssigning}
                      size="sm"
                    >
                      Assign to Me
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <span className="text-gray-500 block mb-1">Affected Services</span>
                {incident.affectedServices?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {incident.affectedServices.map((s: any) => (
                      <Badge key={s.id}>{s.name}</Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-500">No services attached.</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Updates Log</CardTitle>
            </CardHeader>
            <CardContent className={incident.updates?.length ? 'space-y-4' : ''}>
              {!incident.updates || incident.updates.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No updates yet"
                  description="Updates posted on this incident will appear here."
                  className="py-6"
                />
              ) : (
                incident.updates.map((u: any) => (
                  <div key={u.id} className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <span className="text-xs font-semibold text-gray-300">{u.author?.name}</span>
                      <Badge variant={u.isPublic ? 'info' : 'default'} className="text-[10px] shrink-0">
                        {u.isPublic ? 'Public' : 'Internal'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-400 whitespace-pre-wrap">{u.message}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
