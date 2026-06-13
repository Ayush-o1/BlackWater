import { useState, useEffect } from 'react';
import { useOrganization, useUpdateOrganization } from '../../hooks/queries';
import { useAuthStore } from '../../store/useAuthStore';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

export function OrganizationSettings() {
  const { data: org, isLoading } = useOrganization();
  const { mutateAsync: updateOrg, isPending } = useUpdateOrganization();
  const { user } = useAuthStore();
  
  const [name, setName] = useState('');
  
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (org) {
      setName(org.name);
    }
  }, [org]);

  if (isLoading) return <div className="text-gray-400">Loading organization...</div>;
  if (!org) return <div className="text-gray-400">Failed to load organization.</div>;

  const hasUnsavedChanges = name !== org.name;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasUnsavedChanges || !name.trim() || !isAdmin) return;
    await updateOrg({ name });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Settings</CardTitle>
        <p className="text-sm text-gray-500 mt-1">Manage your workspace configuration.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
          <Input
            label="Organization Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isAdmin}
            required
          />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Organization ID</label>
              <div className="bg-dark-300 border border-border rounded-md px-3 py-2 text-sm text-gray-400 font-mono">
                {org.id}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Total Members</label>
              <div className="bg-dark-300 border border-border rounded-md px-3 py-2 text-sm text-gray-400 font-mono">
                {org._count?.users || 1}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border/50 flex items-center justify-between">
            {!isAdmin ? (
              <p className="text-sm text-gray-500">Only organization administrators can modify these settings.</p>
            ) : (
              <div className="w-full flex justify-end">
                <Button type="submit" isLoading={isPending} disabled={!hasUnsavedChanges || !name.trim()}>
                  Save Changes
                </Button>
              </div>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
