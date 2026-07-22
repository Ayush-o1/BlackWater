import { useState } from 'react';
import { useOrganization, useUpdateOrganization } from '../../hooks/queries';
import { useAuthStore } from '../../store/useAuthStore';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';

interface OrgData {
  id: string;
  name: string;
  _count?: { users: number };
}

function OrganizationForm({ org }: { org: OrgData }) {
  const { mutateAsync: updateOrg, isPending } = useUpdateOrganization();
  const { user } = useAuthStore();

  const isAdmin = user?.role === 'ADMIN';

  // Seeded once from the loaded org; this component is remounted (via `key`)
  // whenever the underlying org id changes, so no effect is needed to sync it.
  const [name, setName] = useState(org.name);

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Organization ID</label>
              <div className="bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-gray-400 font-mono truncate">
                {org.id}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Total Members</label>
              <div className="bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-gray-400 font-mono">
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

function OrganizationSettingsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </CardHeader>
      <CardContent className="space-y-6 max-w-xl">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function OrganizationSettings() {
  const { data: org, isLoading } = useOrganization();

  if (isLoading) return <OrganizationSettingsSkeleton />;
  if (!org) return <p className="text-gray-400">Failed to load organization.</p>;

  return <OrganizationForm key={org.id} org={org} />;
}
