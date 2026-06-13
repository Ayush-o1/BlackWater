import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { useIncidents } from '../hooks/queries';
import { CreateIncidentModal } from '../components/incidents/CreateIncidentModal';
import { PlusCircle } from 'lucide-react';

export function Incidents() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const navigate = useNavigate();
  
  // Using React Query to fetch the list
  const { data, isLoading } = useIncidents({ limit: 50 });

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL': return <Badge variant="danger">Critical</Badge>;
      case 'HIGH': return <Badge variant="warning">High</Badge>;
      case 'MEDIUM': return <Badge variant="info">Medium</Badge>;
      default: return <Badge variant="default">Low</Badge>;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Incidents</h1>
          <p className="text-gray-400 mt-2">Manage and track active platform incidents.</p>
        </div>
        <Button variant="danger" onClick={() => setIsCreateOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Declare Incident
        </Button>
      </div>

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
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-gray-500">Loading...</TableCell>
            </TableRow>
          ) : (Array.isArray(data) ? data : [])?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-gray-500 py-12">
                <div className="flex flex-col items-center justify-center space-y-3">
                  <p>No incidents found.</p>
                  <Button variant="secondary" onClick={() => setIsCreateOpen(true)}>Declare First Incident</Button>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            (Array.isArray(data) ? data : [])?.map((incident: any) => (
              <TableRow 
                key={incident.id} 
                className="cursor-pointer"
                onClick={() => navigate(`/incidents/${incident.id}`)}
              >
                <TableCell className="font-medium text-white">{incident.title}</TableCell>
                <TableCell>{getStatusBadge(incident.status)}</TableCell>
                <TableCell>{getSeverityBadge(incident.severity)}</TableCell>
                <TableCell>{incident.assignee?.name || 'Unassigned'}</TableCell>
                <TableCell>{new Date(incident.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <CreateIncidentModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
}
