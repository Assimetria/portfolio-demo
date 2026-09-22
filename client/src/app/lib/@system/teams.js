// @system — Teams management API client
import { api } from './api.js'

export const teamsApi = {
  async list() {
    const data = await api.get('/teams')
    return data.teams
  },

  async create(params) {
    const data = await api.post('/teams', params)
    return data.team
  },

  async get(teamId) {
    const data = await api.get(`/teams/${teamId}`)
    return data.team
  },

  async update(teamId, params) {
    const data = await api.patch(`/teams/${teamId}`, params)
    return data.team
  },

  async remove(teamId) {
    await api.delete(`/teams/${teamId}`)
  },

  async getMembers(teamId) {
    const data = await api.get(`/teams/${teamId}/members`)
    return data.members
  },

  async removeMember(teamId, memberId) {
    await api.delete(`/teams/${teamId}/members/${memberId}`)
  },

  async updateMemberRole(teamId, memberId, role) {
    const data = await api.patch(`/teams/${teamId}/members/${memberId}`, { role })
    return data.member
  },

  async invite(teamId, params) {
    const data = await api.post(`/teams/${teamId}/invitations`, params)
    return data.invitation
  },

  async getPendingInvitations() {
    const data = await api.get('/invitations/pending')
    return data.invitations
  },

  async acceptInvitation(token) {
    const data = await api.post(`/invitations/accept/${token}`)
    return data
  },
}
