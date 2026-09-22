// @system — Webhook management client
import { api } from './api.js'

export const webhooksApi = {
  async list() {
    const data = await api.get('/webhooks')
    return data.webhooks
  },

  async create(params) {
    const data = await api.post('/webhooks', params)
    return data.webhook
  },

  async update(id, params) {
    await api.patch(`/webhooks/${id}`, params)
  },

  async remove(id) {
    await api.delete(`/webhooks/${id}`)
  },

  async getDeliveries(id) {
    const data = await api.get(`/webhooks/${id}/deliveries`)
    return data.deliveries
  },

  async getEvents() {
    const data = await api.get('/webhooks/events')
    return data.events
  },

  async test(id) {
    await api.post(`/webhooks/${id}/test`)
  },
}
