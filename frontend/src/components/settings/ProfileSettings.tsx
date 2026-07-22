import { useState } from 'react';
import { useCurrentUser, useUpdateProfile } from '../../hooks/queries';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';

interface ProfileUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

function ProfileForm({ user }: { user: ProfileUser }) {
  const { mutateAsync: updateProfile, isPending } = useUpdateProfile();

  // Seeded once from the loaded user; this component is remounted (via `key`)
  // whenever the underlying user id changes, so no effect is needed to sync it.
  const [name, setName] = useState(user.name);

  const hasUnsavedChanges = name !== user.name;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasUnsavedChanges || !name.trim()) return;
    await updateProfile({ name });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Details</CardTitle>
        <p className="text-sm text-gray-500 mt-1">Manage your personal information.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
          <Input
            label="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Email Address</label>
            <Input
              value={user.email}
              disabled
              readOnly
              className="bg-muted/50 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1.5">Email changes are not currently supported.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
            <Badge variant={user.role === 'ADMIN' ? 'info' : 'default'}>
              {user.role}
            </Badge>
          </div>

          <div className="pt-4 border-t border-border/50 flex justify-end">
            <Button type="submit" isLoading={isPending} disabled={!hasUnsavedChanges || !name.trim()}>
              Save Changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ProfileSettingsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-56 mt-2" />
      </CardHeader>
      <CardContent className="space-y-6 max-w-xl">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-6 w-16" />
      </CardContent>
    </Card>
  );
}

export function ProfileSettings() {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) return <ProfileSettingsSkeleton />;
  if (!user) return <p className="text-gray-400">Failed to load profile.</p>;

  return <ProfileForm key={user.id} user={user} />;
}
