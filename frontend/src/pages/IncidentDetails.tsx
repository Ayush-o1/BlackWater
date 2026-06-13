import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useIncidentDetails, useUpdateIncidentStatus, useAddIncidentUpdate, useAssignIncident } from '../hooks/queries';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Textarea } from '../components/ui/Textarea';
import { Select } from '../components/ui/Select';
import { Timeline } from '../components/incidents/Timeline';

export function IncidentDetails() {
  const { id } = useParams<{ id: string }>();
  const { data: incident, isLoading } = useIncidentDetails(id!);
  const { mutate: updateStatus, isPending: isUpdatingStatus } = useUpdateIncidentStatus();
  const { mutate: addUpdate, isPending: isAddingUpdate } = useAddIncidentUpdate();
  const { mutate: assignIncident, isPending: isAssigning } = useAssignIncident();
  const { user } = useAuthStore();

  const [message, setMessage] = useState('');
  const [isPublic, setIsPublic] = useState('false');

  if (isLoading) return <div className="text-white">Loading...</div>;
  if (!incident) return <div className="text-white">Incident not found.</div>;

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

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL': return <Badge variant="danger">Critical</Badge>;
      case 'MAJOR': return <Badge variant="warning">Major</Badge>;
      default: return <Badge variant="info">Minor</Badge>;
    }
  };

    const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RESOLVED': return <Badge variant="success">Resolved</Badge>;
      case 'CLOSED': return <Badge variant="default">Closed</Badge>;
      case 'ACKNOWLEDGED': return <Badge variant="warning">Acknowledged</Badge>;
      default: return <Badge variant="danger">Triggered</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight text-white">{incident.title}</h1>
            {getStatusBadge(incident.status)}
            {getSeverityBadge(incident.severity)}
          </div>
          <p className="text-gray-400">Created on {new Date(incident.createdAt).toLocaleString()}</p>
        </div>

        <div className="flex gap-2">
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
                />
                <div className="flex justify-between items-center">
                  <Select
                    className="w-48"
                    value={isPublic}
                    onChange={e => setIsPublic(e.target.value)}
                  >
                    <option value="false">Internal Note</option>
                    <option value="true">Public Update</option>
                  </Select>
                  <Button type="submit" isLoading={isAddingUpdate}>Post Update</Button>
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
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">{incident.assignee?.name || 'Unassigned'}</span>
                  {(!incident.assigneeId || incident.assigneeId !== user?.id) && (
                    <Button 
                      variant="secondary" 
                      onClick={handleAssignToMe} 
                      isLoading={isAssigning}
                      className="py-1 px-2 text-xs"
                    >
                      Assign to Me
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <span className="text-gray-500 block mb-1">Affected Services</span>
                <div className="flex flex-wrap gap-2">
                  {incident.affectedServices?.map((s: any) => (
                    <Badge key={s.id}>{s.name}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Updates Log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {incident.updates?.map((u: any) => (
                <div key={u.id} className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-semibold text-gray-300">{u.author?.name}</span>
                    <Badge variant={u.isPublic ? 'info' : 'default'} className="text-[10px]">
                      {u.isPublic ? 'Public' : 'Internal'}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-400 whitespace-pre-wrap">{u.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
