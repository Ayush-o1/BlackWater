import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { useIncidents, useServices } from '../hooks/queries';
import { Badge } from '../components/ui/Badge';
import { Activity, Server, AlertTriangle, CheckCircle } from 'lucide-react';

export function Dashboard() {
  const { data: servicesData } = useServices();
  const { data: incidentsData } = useIncidents({ limit: 100 });

  const totalServices = servicesData?.services?.length || 0;
  
  const activeIncidents = incidentsData?.incidents?.filter(
    (i: any) => i.status !== 'RESOLVED' && i.status !== 'CLOSED'
  ) || [];
  
  const criticalIncidents = activeIncidents.filter((i: any) => i.severity === 'CRITICAL').length;

  const getSystemStatus = () => {
    if (activeIncidents.length === 0) return { label: 'All Systems Operational', color: 'text-green-400', icon: CheckCircle };
    if (criticalIncidents > 0) return { label: 'Major Outage Active', color: 'text-red-500', icon: AlertTriangle };
    return { label: 'Degraded Performance', color: 'text-yellow-400', icon: Activity };
  };

  const status = getSystemStatus();
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
        <p className="text-gray-400 mt-2">Overview of your system health and recent incidents.</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">System Status</CardTitle>
            <StatusIcon className={`h-4 w-4 ${status.color}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold ${status.color}`}>{status.label}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Active Incidents</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{activeIncidents.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Critical Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{criticalIncidents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Services</CardTitle>
            <Server className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{totalServices}</div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold text-white mb-4">Recent Active Incidents</h2>
        <div className="space-y-4">
          {activeIncidents.length === 0 ? (
            <Card className="bg-surface/50 border-dashed border-border p-8 text-center text-gray-500">
              No active incidents right now. Enjoy the silence!
            </Card>
          ) : (
            activeIncidents.slice(0, 5).map((incident: any) => (
              <Card key={incident.id}>
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-white">{incident.title}</h3>
                    <p className="text-sm text-gray-400 mt-1">Started {new Date(incident.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={incident.severity === 'CRITICAL' ? 'danger' : 'warning'}>
                      {incident.severity}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
