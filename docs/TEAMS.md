# Teams & Collaboration

> Purpose: the teams feature (workspaces, members, roles, invitations, activity log): schema, API, permissions, components.
> Last verified: 2026-09-20 (`server/src/api/@system/teams`, `server/src/db/repos/@system/{teams,team-members,team-invitations,team-activity-log}.js`, `server/src/lib/@system/permissions.js`, `client/src/app/components/@system/Teams`).

> **Disabled by default in the informational template**: teams is a SaaS module gated off via `brand.json` `modules.teams` (runtime override `MODULES_JSON`). Everything below applies only once a product turns it on.

Full-featured team collaboration system with role-based access control, invitation management, and mobile-responsive UI.

---

## Quick Start

### 1. Database Migration

```bash
cd server
npm run migrate
```

This creates 4 tables: `teams`, `team_members`, `team_invitations`, `team_activity_log`.

### 2. Routes and navigation (already wired)

`/app/teams` is registered in `client/src/app/routes/@system/AppRoutes.jsx` (`<ProtectedRoute><TeamsPage /></ProtectedRoute>`) and appears in the sidebar through `client/src/app/config/@system/navigation-defaults.js`. To replace the page, add a `{ path: '/app/teams', element }` entry to `customRoutes` in `routes/@custom/index.jsx`; to hide or rename the sidebar item, override the same `path` in `config/@custom/navigation.js`.

---

## Database Schema

### `teams`

Represents workspaces/organizations that users can create and own.

| Column | Description |
|--------|-------------|
| `id` | Primary key |
| `name` | Team name |
| `slug` | URL-friendly identifier (e.g., 'acme-corp') |
| `description` | Optional description |
| `avatar_url` | Team avatar/logo |
| `owner_id` | User who owns the team |
| `settings` | JSONB for team-specific settings |
| `deleted_at` | Soft delete support |

### `team_members`

Many-to-many relationship between users and teams.

| Column | Description |
|--------|-------------|
| `id` | Primary key |
| `team_id` | Reference to team |
| `user_id` | Reference to user |
| `role` | 'owner', 'admin', 'member', 'viewer' |
| `permissions` | JSONB for granular permission overrides |
| `joined_at` | When the user joined the team |

### `team_invitations`

Pending invitations scoped to specific teams.

| Column | Description |
|--------|-------------|
| `id` | Primary key |
| `team_id` | Team the invitation is for |
| `email` | Invitee email |
| `role` | Role they'll receive on acceptance |
| `invite_token` | Unique token for the invitation link |
| `invited_by` | User who sent the invitation |
| `status` | 'pending', 'accepted', 'expired', 'revoked' |
| `expires_at` | Invitation expiry (default: 7 days) |

### `team_activity_log`

Audit trail of all team actions with IP address and user agent tracking.

### Repositories

- `TeamsRepository` - Team CRUD operations
- `TeamMembersRepository` - Member management
- `TeamInvitationsRepository` - Invitation lifecycle
- `TeamActivityLogRepository` - Activity logging

### Migrations

```bash
npm run db:migrate
```

- `015_teams.js` - Creates teams, team_members, team_invitations tables
- `016_permissions.js` - Creates permissions, role_permissions, user_permissions tables

---

## API Endpoints

### Teams

```
GET    /api/teams                    - List teams the user belongs to
POST   /api/teams                    - Create a new team
GET    /api/teams/:id                - Get team details
PATCH  /api/teams/:id                - Update team details
DELETE /api/teams/:id                - Soft delete team (owner only)
```

### Members

```
GET    /api/teams/:id/members                  - List team members
PATCH  /api/teams/:id/members/:userId          - Update member
PATCH  /api/teams/:id/members/:userId/role     - Update member role
DELETE /api/teams/:id/members/:userId           - Remove member
POST   /api/teams/:id/members/leave             - Leave team
```

### Invitations

```
GET    /api/teams/:id/invitations              - List team invitations
POST   /api/teams/:id/invitations              - Send invitation
DELETE /api/teams/:id/invitations/:invitationId - Revoke invitation
POST   /api/invitations/accept/:token           - Accept team invitation
GET    /api/invitations/pending                 - Get pending invitations for current user
```

### Activity

```
GET    /api/teams/:id/activity?limit=50&offset=0 - View activity log
```

### Permissions

```
GET    /api/teams/:id/permissions/me           - Get my permissions in this team
```

---

## Permissions System

### Role Hierarchy

| Role | Level | Default Permissions |
|------|-------|---------------------|
| **Viewer** | 1 | Read-only access |
| **Member** | 2 | Create and edit content |
| **Admin** | 3 | Manage members, invites, team settings |
| **Owner** | 4 | Full control |

### Default Permissions

**Team Management:**
- `team.read` - View team (all roles)
- `team.update` / `team.settings.manage` - Edit team settings (admin, owner)
- `team.delete` - Delete team (owner only)

**Member Management:**
- `members.read` / `members.view` - View team members list (all roles)
- `members.invite` - Invite new team members (admin, owner)
- `members.remove` - Remove team members (admin, owner)
- `members.update_role` / `members.roles.edit` - Change member roles (admin, owner)

**Billing:**
- `billing.view` - View billing and subscription details
- `billing.manage` - Manage billing, payment methods, and subscriptions

**Content:**
- `content.create` - Create new content/resources
- `content.edit` - Edit existing content/resources
- `content.delete` - Delete content/resources
- `content.view` - View content/resources

**API Keys:**
- `api_keys.create` - Create API keys
- `api_keys.view` - View API keys
- `api_keys.delete` - Delete API keys

**Audit:**
- `audit.view` - View audit logs

**Invitations:**
- `invitations.*` - Manage invitations (admin, owner)

### Server-Side Permission Checks

Use the `requireTeamMembership` middleware:

```javascript
const { requireTeamMembership } = require('./lib/@system/permissions')

// Require specific permission
router.get('/api/teams/:teamId/data',
  authenticate,
  requireTeamMembership({ permission: 'content.read' }),
  async (req, res) => {
    // req.teamMember - Full member object
    // req.teamRole - User's role string
    // req.teamPermissions - Custom permissions array
    res.json({ data: '...' })
  }
)

// Require minimum role
router.post('/api/teams/:teamId/settings',
  authenticate,
  requireTeamMembership({ minRole: 'admin' }),
  async (req, res) => {
    // Only admins and owners can access
  }
)

// Owner only
router.delete('/api/teams/:teamId',
  authenticate,
  requireTeamOwner(),
  async (req, res) => {
    // Only team owner can delete
  }
)
```

Or check permissions programmatically:

```javascript
const hasPermission = await PermissionRepo.checkUserPermission(
  userId,
  'members.invite',
  teamId
)
```

### Client-Side Permission Checks

```jsx
function TeamContent({ teamRole }) {
  const canEdit = ['member', 'admin', 'owner'].includes(teamRole)
  const canDelete = ['admin', 'owner'].includes(teamRole)
  const canManageMembers = ['admin', 'owner'].includes(teamRole)

  return (
    <div>
      {canEdit && <Button>Edit</Button>}
      {canDelete && <Button>Delete</Button>}
      {canManageMembers && <Button>Manage Members</Button>}
    </div>
  )
}
```

Or create a hook:

```javascript
// hooks/useTeamPermission.js
export function useTeamPermission(teamRole, permission) {
  const PERMISSIONS = {
    'content.edit': ['member', 'admin', 'owner'],
    'content.delete': ['admin', 'owner'],
    'members.invite': ['admin', 'owner'],
  }
  return PERMISSIONS[permission]?.includes(teamRole) || false
}
```

### Per-User Permission Overrides

Individual users can have permissions granted or revoked beyond their role:

```javascript
// Grant a specific permission
await PermissionRepo.grantUserPermission(userId, 'billing.manage', teamId)

// Revoke a permission
await PermissionRepo.revokeUserPermission(userId, 'members.remove', teamId)
```

---

## Frontend

### Pages

**`/app/teams`** - Teams listing page
- Grid of team cards with role badges
- Create new team button
- Shows user's role and member count on each team

**`/app/teams/:id`** - Team detail page (3 tabs)
- **Members Tab:** View/manage team members, update roles, remove members
- **Invitations Tab:** Send invitations, view pending/accepted invites, revoke invitations
- **Settings Tab:** Edit team name/description, delete team (owner only)

### Components

**Location:** `client/src/app/components/@system/Teams/`

#### TeamList

```jsx
import { TeamList } from '../components/@system/Teams'

<TeamList
  onTeamSelect={(team) => navigate(`/teams/${team.id}`)}
  onCreateTeam={() => setShowModal(true)}
/>
```

Props: `onTeamSelect(team)`, `onCreateTeam()`

#### MemberList

```jsx
import { MemberList } from '../components/@system/Teams'

<MemberList
  teamId={teamId}
  userRole="admin"
  onInviteMember={() => switchToInviteTab()}
/>
```

Props: `teamId`, `userRole` ('owner'|'admin'|'member'|'viewer'), `onInviteMember()`

#### InvitationManager

```jsx
import { InvitationManager } from '../components/@system/Teams'

<InvitationManager teamId={teamId} userRole="admin" />
```

Props: `teamId`, `userRole` (only admins/owners see this)

#### CreateTeamModal

```jsx
import { CreateTeamModal } from '../components/@system/Teams'

<CreateTeamModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onTeamCreated={(team) => navigate(`/teams/${team.id}`)}
/>
```

Props: `isOpen`, `onClose()`, `onTeamCreated(team)`

### API Client

**Location:** `client/src/app/lib/@custom/teams.js`

```javascript
import { teamsApi } from '../lib/@custom/teams'

teamsApi.list()
teamsApi.create({ name, description })
teamsApi.get(id)
teamsApi.update(id, { name, description })
teamsApi.delete(id)
teamsApi.listMembers(teamId)
teamsApi.removeMember(teamId, userId)
teamsApi.updateMemberRole(teamId, userId, role)
teamsApi.inviteMember(teamId, { email, role, name })
teamsApi.listInvitations(teamId)
teamsApi.revokeInvitation(teamId, token)
teamsApi.acceptInvitation(token)
teamsApi.getMyPermissions(teamId)
```

### Mobile Responsiveness

- Responsive grid layouts (1 col mobile, 2/3 cols desktop)
- Touch-friendly buttons (44px min height)
- Mobile drawer for actions
- Stack layout on mobile

---

## User Flows

### Creating a Team

1. Click "New Team" on `/app/teams`
2. Fill name (required) and description (optional)
3. System creates team with unique slug
4. User becomes owner automatically
5. Redirect to team detail page

### Inviting Members

1. Navigate to team detail page
2. Click "Invitations" tab (admin/owner only)
3. Enter email and select role
4. System sends invitation with unique token
5. Invitation expires after 7 days
6. Invitee clicks link and is redirected to accept flow
7. On accept: added to team, invitation marked accepted

### Managing Members

1. View members in "Members" tab
2. Update role via dropdown (respects role hierarchy)
3. Remove member via trash icon
4. Activity logged for audit trail

---

## Email Invitations

### Configuration

```bash
# .env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM_EMAIL=noreply@yourapp.com
SMTP_FROM_NAME="Your App"
```

### Customize Invitation Email

```javascript
// server/src/lib/@system/Email/templates/team-invitation.js
module.exports = {
  subject: ({ teamName }) => `You've been invited to join ${teamName}`,
  html: ({ teamName, inviterName, role, acceptUrl }) => `
    <h1>Join ${teamName}</h1>
    <p>${inviterName} has invited you to join as a ${role}.</p>
    <a href="${acceptUrl}">Accept Invitation</a>
  `,
  text: ({ teamName, inviterName, role, acceptUrl }) => `
    ${inviterName} has invited you to join ${teamName} as a ${role}.
    Accept: ${acceptUrl}
  `
}
```

### Invitation Flow

1. Admin sends `POST /api/teams/:teamId/invitations` with `{ email, role }`
2. User receives email with token link: `https://yourapp.com/invitations/accept?token=abc123...`
3. User accepts (must be logged in): `POST /api/invitations/accept/abc123...`
4. User is added to team with specified role

---

## Activity Logging

All team actions are automatically logged:

- `team.created`, `team.updated`
- `member.joined`, `member.removed`, `member.left`, `member.role_updated`
- `invitation.sent`, `invitation.revoked`

Custom logging:

```javascript
await req.db.teamActivityLog.log({
  team_id: teamId,
  user_id: req.user.id,
  action: 'custom.action',
  details: { key: 'value' },
  ip_address: req.ip,
  user_agent: req.get('user-agent')
})
```

---

## Customization

### Styling

All components use Tailwind CSS. Customize by overriding classes or copying components to your `@custom` folder:

```
client/src/app/components/@custom/Teams/TeamList.jsx
```

### Adding Custom Fields

**Backend:**

```javascript
// server/src/db/migrations/@custom/003_custom_team_fields.js   (cd server && npm run migrate:create -- custom_team_fields)
'use strict'
exports.up = async (db) => {
  await db.none(`
    ALTER TABLE teams
      ADD COLUMN IF NOT EXISTS logo_url TEXT,
      ADD COLUMN IF NOT EXISTS website  TEXT
  `)
}
exports.down = async (db) => {
  await db.none('ALTER TABLE teams DROP COLUMN IF EXISTS logo_url, DROP COLUMN IF EXISTS website')
}
```

### Custom Roles

Add new roles in `server/src/lib/@system/permissions.js`:

```javascript
const ROLE_HIERARCHY = {
  viewer: 1,
  member: 2,
  moderator: 3,  // New role
  admin: 4,
  owner: 5
}

const PERMISSIONS = {
  'content.moderate': ['moderator', 'admin', 'owner'],
}
```

---

## Testing

### Backend Tests

```javascript
describe('Teams API', () => {
  let authCookie, teamId

  beforeEach(async () => {
    authCookie = await createTestUser()
  })

  test('should create team', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set('Cookie', authCookie)
      .send({ name: 'Test Team' })

    expect(res.status).toBe(201)
    expect(res.body.team.name).toBe('Test Team')
    teamId = res.body.team.id
  })

  test('should not allow member to remove admin', async () => {
    const res = await request(app)
      .delete(`/api/teams/${teamId}/members/${adminId}`)
      .set('Cookie', memberCookie)

    expect(res.status).toBe(403)
  })
})
```

### Frontend Tests

```javascript
import { render, screen, waitFor } from '@testing-library/react'
import { TeamList } from '../components/@system/Teams'

jest.mock('../lib/@custom/teams', () => ({
  teamsApi: {
    list: jest.fn(() => Promise.resolve({
      teams: [
        { id: 1, name: 'Team 1', role: 'owner' },
        { id: 2, name: 'Team 2', role: 'member' },
      ]
    }))
  }
}))

test('renders team list', async () => {
  render(<TeamList />)
  await waitFor(() => {
    expect(screen.getByText('Team 1')).toBeInTheDocument()
    expect(screen.getByText('Team 2')).toBeInTheDocument()
  })
})
```

### Testing Recommendations

- Test all permission levels (owner, admin, member, viewer)
- Test invitation flow (send, accept, revoke, expire)
- Test role hierarchy (can't promote above own role)
- Test mobile responsiveness on actual devices
- Test team deletion cascade (members, invitations cleaned up)
- Test IDOR attack vectors

---

## Security

- All team operations require authentication
- Permission checks enforced at API level on every sensitive operation
- Invitation tokens are unique and expire after 7 days
- Email validation on invitation acceptance
- IDOR protection (can't access other teams' data)
- Soft deletes preserve data integrity
- Owner role cannot be removed if they're the last owner
- Users can only see teams they're members of
- Activity logging for compliance/audit

---

## Deployment Checklist

- [ ] Run database migrations
- [ ] Configure email service (SMTP)
- [ ] Test invitation emails
- [ ] Set up CORS for invite links
- [ ] Add team routes to frontend
- [ ] Test permissions in production
- [ ] Configure rate limiting for invitations
- [ ] Set up periodic cleanup of expired invitations

---

## Troubleshooting

### Invitations not being sent
1. Check email configuration in `.env`
2. Check server logs for email errors
3. Verify SMTP credentials

### Permissions not working
1. Ensure `requireTeamMembership` middleware is applied
2. Check `req.teamRole` is set correctly
3. Verify permission names match `PERMISSIONS` object

### UI components not rendering
1. Check imports match component locations
2. Verify API responses match expected format
3. Check browser console for errors

---

## Integration with Existing Collaborators

The existing `collaborators` table remains for backwards compatibility (workspace-level collaborators not scoped to teams). To fully integrate, consider migrating existing collaborators to team members, or keep both systems for different use cases.

---

## Future Enhancements

- Resend invitation
- Bulk invite (CSV upload)
- Team roles with custom permissions / permission groups
- Team settings (visibility, join policy, branding, integrations)
- Team analytics/insights
- Team billing and subscription management
- Team-scoped resources (content, API keys, etc.)
- Team switcher component in the header
- Slack/Discord webhook integrations
- Guest access (time-limited, read-only)

---

## Files

- Backend: `server/src/api/@system/teams/*`
- Frontend pages: `client/src/app/pages/app/*Teams*.jsx`
- Components: `client/src/app/components/@system/Teams/*`
- API client: `client/src/app/lib/@custom/teams.js`
- Permissions: `server/src/lib/@system/permissions.js`
- Database schema: `server/src/db/schemas/@system/teams.sql`
- Routes: Configured in `AppRoutes.jsx`
