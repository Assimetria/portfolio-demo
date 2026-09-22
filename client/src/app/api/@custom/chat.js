// @custom — Chat API client functions
// Uses the shared apiClient for authenticated requests to the chat endpoints.

import { apiClient } from '@/app/lib/@custom/apiClient';

/**
 * Fetch all threads for the current user.
 * @param {{ limit?: number, offset?: number }} params
 * @returns {Promise<{ threads: Array }>}
 */
export const fetchThreads = (params = {}) => {
  const query = new URLSearchParams();
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));
  const qs = query.toString();
  return apiClient.get(`/chat/threads${qs ? `?${qs}` : ''}`);
};

/**
 * Create a new thread.
 * @param {{ title?: string }} data
 * @returns {Promise<{ thread: Object }>}
 */
export const createThread = (data = {}) =>
  apiClient.post('/chat/threads', data);

/**
 * Get a single thread by id.
 * @param {number|string} id
 * @returns {Promise<{ thread: Object }>}
 */
export const getThread = (id) =>
  apiClient.get(`/chat/threads/${id}`);

/**
 * Update a thread's title.
 * @param {number|string} id
 * @param {{ title: string }} data
 * @returns {Promise<{ thread: Object }>}
 */
export const updateThread = (id, data) =>
  apiClient.patch(`/chat/threads/${id}`, data);

/**
 * Delete a thread by id.
 * @param {number|string} id
 * @returns {Promise<{ message: string }>}
 */
export const deleteThread = (id) =>
  apiClient.delete(`/chat/threads/${id}`);

/**
 * Fetch messages for a thread.
 * @param {number|string} threadId
 * @param {{ limit?: number, offset?: number }} params
 * @returns {Promise<{ messages: Array }>}
 */
export const fetchMessages = (threadId, params = {}) => {
  const query = new URLSearchParams();
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));
  const qs = query.toString();
  return apiClient.get(`/chat/threads/${threadId}/messages${qs ? `?${qs}` : ''}`);
};

/**
 * Add a message to a thread.
 * @param {number|string} threadId
 * @param {{ content: string, sender?: string, metadata?: Object }} data
 * @returns {Promise<{ message: Object }>}
 */
export const addMessage = (threadId, data) =>
  apiClient.post(`/chat/threads/${threadId}/messages`, data);