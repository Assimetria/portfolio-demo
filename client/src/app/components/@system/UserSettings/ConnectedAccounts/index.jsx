// @system — Connected accounts management
// Shows third-party integrations and OAuth connections.
// Allows users to connect/disconnect services.

import { useState } from 'react'
import { Check, X, ExternalLink, AlertCircle } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'
import { Card } from '../../Card'
import { Button } from '../../Button'
import { Badge } from '../../Badge'
import { Alert } from '../../Alert'

export function ConnectedAccounts({
  accounts = [],
  onConnect,
  onDisconnect,
  loading = {},
  className
}) {
  const [disconnecting, setDisconnecting] = useState(null)

  const handleDisconnect = async (accountId) => {
    const account = accounts.find(a => a.id === accountId)
    if (!account) return

    const confirmed = window.confirm(
      `Disconnect ${account.provider}? This will revoke access and may affect connected features.`
    )

    if (confirmed) {
      setDisconnecting(accountId)
      try {
        await onDisconnect?.(accountId)
      } catch (error) {
        console.error('Disconnect failed:', error)
      } finally {
        setDisconnecting(null)
      }
    }
  }

  const connectedAccounts = accounts.filter(a => a.connected)
  const availableAccounts = accounts.filter(a => !a.connected)

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Connected Accounts</h3>
        <p className="text-sm text-brand-text-muted">
          Connect third-party services to enhance your experience.
        </p>
      </div>

      {/* Connected accounts */}
      {connectedAccounts.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3">Active Connections</h4>
          <Card className="divide-y">
            {connectedAccounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                onAction={() => handleDisconnect(account.id)}
                actionLabel="Disconnect"
                actionVariant="destructive"
                loading={disconnecting === account.id}
              />
            ))}
          </Card>
        </div>
      )}

      {/* Available accounts */}
      {availableAccounts.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3">
            {connectedAccounts.length > 0 ? 'Available Integrations' : 'Connect an Account'}
          </h4>
          <Card className="divide-y">
            {availableAccounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                onAction={() => onConnect?.(account.id)}
                actionLabel="Connect"
                loading={loading[account.id]}
              />
            ))}
          </Card>
        </div>
      )}

      {/* Info alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <div className="text-sm">
          <p className="font-medium mb-1">Your data stays private</p>
          <p className="text-brand-text-muted">
            We only request the minimum permissions needed. You can revoke access at any time.
          </p>
        </div>
      </Alert>
    </div>
  )
}

function AccountRow({
  account,
  onAction,
  actionLabel,
  actionVariant,
  loading
}) {
  const Icon = account.icon
  const isConnected = account.connected

  return (
    <div className="flex items-center gap-4 p-4">
      {/* Icon */}
      <div className={cn(
        'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg',
        isConnected ? 'bg-brand-primary/10' : 'bg-brand-surface'
      )}>
        {Icon ? (
          <Icon className={cn(
            'h-6 w-6',
            isConnected ? 'text-brand-primary' : 'text-brand-text-muted'
          )} />
        ) : (
          <span className="text-lg">{account.emoji}</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h5 className="text-sm font-medium">{account.provider}</h5>
          {isConnected && (
            <Badge variant="secondary" className="text-xs">
              <Check className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>
        
        <p className="text-sm text-brand-text-muted">
          {account.description}
        </p>

        {isConnected && account.connectedEmail && (
          <p className="text-xs text-brand-text-muted mt-1">
            {account.connectedEmail}
          </p>
        )}

        {isConnected && account.connectedAt && (
          <p className="text-xs text-brand-text-muted mt-1">
            Connected {new Date(account.connectedAt).toLocaleDateString()}
          </p>
        )}

        {isConnected && account.permissions && (
          <div className="flex flex-wrap gap-1 mt-2">
            {account.permissions.map((perm, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {perm}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Action */}
      <div className="flex items-center gap-2 shrink-0">
        {isConnected && account.manageUrl && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(account.manageUrl, '_blank')}
            className="gap-1"
          >
            Manage
            <ExternalLink className="h-3 w-3" />
          </Button>
        )}
        
        <Button
          variant={actionVariant || (isConnected ? 'outline' : 'default')}
          size="sm"
          onClick={onAction}
          disabled={loading}
          className="min-w-[100px]"
        >
          {loading ? (
            <span className="h-4 w-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />
          ) : (
            actionLabel
          )}
        </Button>
      </div>
    </div>
  )
}

// Example accounts structure:
// import { Github, Twitter, Facebook, Slack, Google, Mail } from 'lucide-react'
//
// const accounts = [
//   {
//     id: 'google',
//     provider: 'Google',
//     description: 'Sign in with Google and sync your calendar',
//     icon: Google,
//     connected: true,
//     connectedEmail: 'user@gmail.com',
//     connectedAt: '2024-01-15T10:30:00Z',
//     permissions: ['Read email', 'Calendar access'],
//     manageUrl: 'https://myaccount.google.com/connections'
//   },
//   {
//     id: 'github',
//     provider: 'GitHub',
//     description: 'Connect repositories and enable CI/CD integrations',
//     icon: Github,
//     connected: false
//   },
//   {
//     id: 'slack',
//     provider: 'Slack',
//     description: 'Receive notifications in your Slack workspace',
//     icon: Slack,
//     connected: true,
//     connectedEmail: 'workspace.slack.com',
//     connectedAt: '2024-02-20T14:15:00Z',
//     permissions: ['Post messages', 'Read channels'],
//     manageUrl: 'https://slack.com/apps/manage'
//   },
//   {
//     id: 'twitter',
//     provider: 'Twitter / X',
//     description: 'Share updates and connect your profile',
//     icon: Twitter,
//     connected: false
//   }
// ]
