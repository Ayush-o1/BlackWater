import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { useServices } from '../hooks/queries';
import { CreateServiceModal } from '../components/services/CreateServiceModal';
import { PlusCircle } from 'lucide-react';

export function Services() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const navigate = useNavigate();
  const { data, isLoading } = useServices();

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
          <h1 className="text-3xl font-bold tracking-tight text-white">Services</h1>
          <p className="text-gray-400 mt-2">Manage your platform components and view their health.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Service
        </Button>
      </div>

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
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-gray-500">Loading...</TableCell>
            </TableRow>
          ) : data?.services?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-gray-500">No services tracked.</TableCell>
            </TableRow>
          ) : (
            data?.services?.map((service: any) => (
              <TableRow 
                key={service.id} 
                className="cursor-pointer"
                onClick={() => navigate(`/services/${service.id}`)}
              >
                <TableCell className="font-medium text-white">{service.name}</TableCell>
                <TableCell className="max-w-md truncate">{service.description || '—'}</TableCell>
                <TableCell>{getStatusBadge(service.status)}</TableCell>
                <TableCell>{new Date(service.updatedAt).toLocaleString()}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <CreateServiceModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
}
