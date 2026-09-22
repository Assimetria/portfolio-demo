// @system — Users tab for AdminPage
import { RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/@system/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../../components/@system/Table'
import { Button } from '../../../../components/@system/ui/button'
import { AdminUsersTableSkeleton } from '../../../../components/@system/Skeleton'
import { PAGE_SIZE } from './parts'
import { formatDate } from './format'

export function UsersTab({
  users, usersTotal, usersLoading, usersError,
  search, setSearch,
  usersPage, setUsersPage, usersTotalPages,
  roleUpdating,
  fetchUsers,
  handleRoleToggle,
  currentUser,
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <CardTitle>Users ({usersTotal || users.length})</CardTitle>
          <CardDescription>All registered users.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search users…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 w-48 rounded-md border border-brand-border bg-brand-bg pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchUsers(usersPage, search)}
            disabled={usersLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-3 w-3 ${usersLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {usersError && (
          <p className="text-sm text-[var(--color-error)] mb-4">{usersError}</p>
        )}
        {usersLoading ? (
          <AdminUsersTableSkeleton />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-xs text-brand-text-muted">
                      #{u.id}
                    </TableCell>
                    <TableCell className="font-medium">{u.name ?? '—'}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.role === 'admin'
                            ? 'bg-brand-primary/10 text-brand-primary'
                            : 'bg-brand-surface text-brand-text-muted'
                        }`}
                      >
                        {u.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-brand-text-muted text-sm">
                      {formatDate(u.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={roleUpdating === u.id || u.id === currentUser?.id}
                        onClick={() => handleRoleToggle(u)}
                        className="text-xs h-7"
                      >
                        {roleUpdating === u.id
                          ? 'Saving…'
                          : u.role === 'admin' ? 'Demote' : 'Make Admin'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!usersLoading && users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-brand-text-muted py-8">
                      {search.length >= 2 ? 'No users match your search.' : 'No users found.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between text-sm text-brand-text-muted">
              <span>Page {usersPage} of {usersTotalPages}</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={usersPage <= 1}
                  onClick={() => {
                    const p = usersPage - 1
                    setUsersPage(p)
                    fetchUsers(p, search)
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={usersPage >= usersTotalPages || users.length < PAGE_SIZE}
                  onClick={() => {
                    const p = usersPage + 1
                    setUsersPage(p)
                    fetchUsers(p, search)
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
