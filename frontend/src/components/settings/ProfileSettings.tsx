import { useState, useEffect } from 'react';
import { useCurrentUser, useUpdateProfile } from '../../hooks/queries';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export function ProfileSettings() {
  const { data: user, isLoading } = useCurrentUser();
  const { mutateAsync: updateProfile, isPending } = useUpdateProfile();
  
  const [name, setName] = useState('');
  
  useEffect(() => {
    if (user) {
      setName(user.name);
    }
  }, [user]);

  if (isLoading) return <div className="text-gray-400">Loading profile...</div>;
  if (!user) return <div className="text-gray-400">Failed to load profile.</div>;

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
            <label className="block text-sm font-medium text-gray-300 mb-1">Email Address</label>
            <Input
              value={user.email}
              disabled
              readOnly
              className="bg-dark-300/50 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Email changes are not currently supported.</p>
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
