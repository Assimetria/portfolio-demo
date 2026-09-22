/**
 * TeamList Component
 * Displays a list of teams the user belongs to
 */

import React, { useState, useEffect } from 'react'
import { teamsApi } from '../../../../lib/@custom/teams'
import { Card } from '../../Card'
import { Button } from '../../ui/button'
import { Badge } from '../../ui/badge'
import { Spinner } from '../../Loading'
import { ChevronRight } from 'lucide-react'

export function TeamList({ onTeamSelect, onCreateTeam }) {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadTeams()
  }, [])

  async function loadTeams() {
    try {
      setLoading(true)
      const data = await teamsApi.list()
      setTeams(data.teams || [])
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to load teams')
    } finally {
      setLoading(false)
    }
  }

  function getRoleBadgeClass(role) {
    const classes = {
      owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      admin: 'bg-[var(--color-info-bg)] text-[var(--color-info)] dark:bg-[var(--color-info-bg)]/30 dark:text-[var(--color-info)]',
      member: 'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)]/30 dark:text-[var(--color-success)]',
      viewer: 'bg-brand-surface text-brand-text',
    }
    return classes[role] || classes.viewer
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-[var(--color-error-bg)] border border-[var(--color-error)]/20 rounded-lg">
        <p className="text-[var(--color-error)]">{error}</p>
        <Button onClick={loadTeams} className="mt-2">
          Try Again
        </Button>
      </div>
    )
  }

  if (teams.length === 0) {
    return (
      <Card className="p-8 text-center">
        <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
        <p className="text-brand-text-muted mb-4">
          Create your first team to start collaborating with others.
        </p>
        {onCreateTeam && (
          <Button onClick={onCreateTeam}>Create Team</Button>
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Your Teams</h2>
        {onCreateTeam && (
          <Button onClick={onCreateTeam} size="sm">
            + New Team
          </Button>
        )}
      </div>

      {teams.map((team) => (
        <Card
          key={team.id}
          className="p-4 hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => onTeamSelect?.(team)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg">{team.name}</h3>
                <Badge className={getRoleBadgeClass(team.role)}>
                  {team.role}
                </Badge>
              </div>
              
              {team.description && (
                <p className="text-brand-text-muted text-sm mb-2">
                  {team.description}
                </p>
              )}
              
              <div className="flex items-center gap-4 text-sm text-brand-text-muted">
                {team.member_count && (
                  <span>{team.member_count} member{team.member_count !== 1 ? 's' : ''}</span>
                )}
                <span>Created {new Date(team.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <button 
              className="text-brand-text-muted hover:text-brand-text transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                onTeamSelect?.(team)
              }}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </Card>
      ))}
    </div>
  )
}
