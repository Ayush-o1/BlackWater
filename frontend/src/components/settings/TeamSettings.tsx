import { useState } from 'react';
import { useUsers } from '../../hooks/queries';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../ui/Table';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Search } from 'lucide-react';

export function TeamSettings() {
  const { data: users, isLoading } = useUsers();
  const [search, setSearch] = useState('');

  if (isLoading) return <div className="text-gray-400">Loading team members...</div>;

  const filteredUsers = users?.filter((u: any) => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <CardTitle>Team Members</CardTitle>
          <p className="text-sm text-gray-500 mt-1">People with access to this workspace.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-500" />
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            placeholder="Search members..."
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="border border-border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!filteredUsers?.length ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                    No team members found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-white">{user.name}</span>
                        <span className="text-sm text-gray-500">{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'ADMIN' ? 'info' : 'default'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-400">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
