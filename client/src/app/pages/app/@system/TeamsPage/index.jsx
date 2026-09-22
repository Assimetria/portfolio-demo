// @system — Team management page
// Allows users to create teams, invite members, and manage team settings.
import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  Plus,
  Trash2,
  Mail,
  Shield,
  Crown,
  UserMinus,
  MoreHorizontal,
} from 'lucide-react'
import { DashboardLayout } from '../../../../components/@system/Dashboard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/@system/Card'
import { FormField, Input } from '../../../../components/@system/Form'
import { Button } from '../../../../components/@system/ui/button'
import { Modal } from '../../../../components/@system/Modal'
import { Badge } from '../../../../components/@system/Badge'
import { teamsApi } from '../../../../lib/@system/teams'

function RoleBadge({ role }) {
  const variants = {
    owner: { label: 'Owner', className: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/20' },
    admin: { label: 'Admin', className: 'bg-[var(--color-info)]/10 text-[var(--color-info)] border-[var(--color-info)]/20' },
    member: { label: 'Member', className: 'bg-brand-surface text-brand-text-muted border-brand-border' },
  }
  const v = variants[role] || variants.member
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${v.className}`}>
      {v.label}
    </span>
  )
}

function TeamCard({ team, onSelect, onDelete }) {
  return (
    <Card className="cursor-pointer transition-colors hover:border-primary/30" onClick={() => onSelect(team)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary font-bold text-sm">
              {team.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-brand-text">{team.name}</h3>
              {team.description && (
                <p className="mt-0.5 text-xs text-brand-text-muted line-clamp-1">{team.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-brand-text-muted">
              {team.member_count ?? '—'} member{(team.member_count ?? 0) !== 1 ? 's' : ''}
            </span>
            {team.user_role === 'owner' && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(team) }}
                className="rounded p-1 text-brand-text-muted hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] transition-colors"
                title="Delete team"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TeamDetailView({ team, onBack }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await teamsApi.getMembers(team.id)
      setMembers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members')
    } finally {
      setLoading(false)
    }
  }, [team.id])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  async function handleInvite(e) {
    e.preventDefault()
    if (!inviteEmail.trim()) {
      setInviteError('Email is required')
      return
    }
    setInviting(true)
    setInviteError('')
    try {
      await teamsApi.invite(team.id, { email: inviteEmail.trim(), role: inviteRole })
      setInviteOpen(false)
      setInviteEmail('')
      setInviteRole('member')
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  async function handleRemoveMember(member) {
    if (!confirm(`Remove ${member.email || member.name} from the team?`)) return
    try {
      await teamsApi.removeMember(team.id, member.id)
      setMembers((prev) => prev.filter((m) => m.id !== member.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  const isOwner = team.user_role === 'owner'
  const isAdmin = isOwner || team.user_role === 'admin'

  return (
    <>
      <div className="mb-6">
        <button
          onClick={onBack}
          className="text-sm text-brand-text-muted hover:text-brand-text transition-colors mb-4 inline-flex items-center gap-1"
        >
          &larr; Back to teams
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{team.name}</h1>
            {team.description && (
              <p className="mt-1 text-brand-text-muted">{team.description}</p>
            )}
          </div>
          {isAdmin && (
            <Button onClick={() => setInviteOpen(true)} className="gap-2">
              <Mail className="h-4 w-4" />
              Invite
            </Button>
          )}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-[var(--color-error)]">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {members.length} member{members.length !== 1 ? 's' : ''} in this team
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-brand-surface" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-32 bg-brand-surface rounded" />
                    <div className="h-2.5 w-48 bg-brand-surface rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="mx-auto h-8 w-8 text-brand-text-muted/40" />
              <p className="mt-3 text-sm text-brand-text-muted">No members yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-lg border border-brand-border p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-surface text-xs font-semibold text-brand-text">
                      {(member.name || member.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-brand-text">{member.name || member.email}</p>
                      {member.name && member.email && (
                        <p className="text-xs text-brand-text-muted">{member.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <RoleBadge role={member.role} />
                    {isOwner && member.role !== 'owner' && (
                      <button
                        onClick={() => handleRemoveMember(member)}
                        className="rounded p-1 text-brand-text-muted hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] transition-colors"
                        title="Remove member"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite modal */}
      <Modal
        open={inviteOpen}
        onClose={() => { setInviteOpen(false); setInviteEmail(''); setInviteError('') }}
        title="Invite team member"
        description="Send an invitation to join this team."
      >
        <form onSubmit={handleInvite} className="space-y-4">
          <FormField label="Email address">
            <Input
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              autoFocus
              required
            />
          </FormField>
          <FormField label="Role">
            <div className="flex gap-2">
              {['member', 'admin'].map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    inviteRole === r
                      ? 'border-primary bg-brand-primary/10 text-brand-primary'
                      : 'border-brand-border text-brand-text-muted hover:border-primary/50'
                  }`}
                  onClick={() => setInviteRole(r)}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </FormField>
          {inviteError && <p className="text-sm text-[var(--color-error)]">{inviteError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={inviting}>
              {inviting ? 'Sending...' : 'Send invitation'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

export function TeamsPage() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedTeam, setSelectedTeam] = useState(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchTeams()
  }, [])

  async function fetchTeams() {
    setLoading(true)
    setError('')
    try {
      const data = await teamsApi.list()
      setTeams(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) {
      setCreateError('Team name is required')
      return
    }
    setCreating(true)
    setCreateError('')
    try {
      const team = await teamsApi.create({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      })
      setTeams((prev) => [team, ...prev])
      setCreateOpen(false)
      setNewName('')
      setNewDesc('')
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create team')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await teamsApi.remove(deleteTarget.id)
      setTeams((prev) => prev.filter((t) => t.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete team')
    } finally {
      setDeleting(false)
    }
  }

  async function handleSelectTeam(team) {
    try {
      const detail = await teamsApi.get(team.id)
      setSelectedTeam(detail)
    } catch {
      setSelectedTeam(team)
    }
  }

  return (
    <DashboardLayout>
      <DashboardLayout.Content className="max-w-4xl">
        {selectedTeam ? (
          <TeamDetailView
            team={selectedTeam}
            onBack={() => setSelectedTeam(null)}
          />
        ) : (
          <>
            <div className="mb-8 flex items-start justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">Teams</h1>
                <p className="mt-1 text-brand-text-muted">
                  Create and manage teams to collaborate with others.
                </p>
              </div>
              <Button onClick={() => setCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                New Team
              </Button>
            </div>

            {error && <p className="mb-4 text-sm text-[var(--color-error)]">{error}</p>}

            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3 animate-pulse">
                        <div className="h-10 w-10 rounded-lg bg-brand-surface" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3.5 w-36 bg-brand-surface rounded" />
                          <div className="h-2.5 w-56 bg-brand-surface rounded" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : teams.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="mx-auto h-10 w-10 text-brand-text-muted/40" />
                  <h3 className="mt-4 text-sm font-medium text-brand-text">No teams yet</h3>
                  <p className="mt-1 text-sm text-brand-text-muted">
                    Create a team to start collaborating.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-2"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Create your first team
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {teams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    onSelect={handleSelectTeam}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </DashboardLayout.Content>

      {/* Create team modal */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setNewName(''); setNewDesc(''); setCreateError('') }}
        title="Create Team"
        description="Give your team a name and optional description."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <FormField label="Team Name">
            <Input
              placeholder="e.g. Engineering, Marketing"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          </FormField>
          <FormField label="Description (optional)">
            <Input
              placeholder="What does this team work on?"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
          </FormField>
          {createError && <p className="text-sm text-[var(--color-error)]">{createError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating...' : 'Create Team'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Team"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? All team members will lose access and this cannot be undone.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete Team'}
          </Button>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
