// @system — API key management client
import { api } from './api.js'

export const apiKeysApi = {
  async list() {
    const data = await api.get('/api-keys')
    return data.apiKeys
  },

  async create(params) {
    const data = await api.post('/api-keys', params)
    const { key: rawKey, ...apiKey } = data.apiKey
    return { apiKey, rawKey }
  },

  async revoke(id) {
    await api.delete(`/api-keys/${id}`)
  },

  async getScopes() {
    const data = await api.get('/api-keys/scopes')
    return data.scopes
  },

  async updateScopes(id, scopes) {
    await api.patch(`/api-keys/${id}/scopes`, { scopes })
  },

  async getUsage(id, days = 30) {
    const data = await api.get(`/api-keys/${id}/usage?days=${days}`)
    return data.usage
  },
}
