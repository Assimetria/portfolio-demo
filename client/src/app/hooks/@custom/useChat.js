// @custom — Chat state management hook
// Provides a unified interface for managing chat threads, messages,
// loading states, and errors. Wraps the @custom chat API client.

import { useState, useCallback, useRef, useMemo } from 'react';
import {
  fetchThreads,
  createThread,
  getThread,
  updateThread,
  deleteThread,
  fetchMessages,
  addMessage,
} from '@/app/api/@custom/chat';

export function useChat() {
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);

  const clearError = useCallback(() => setError(null), []);

  const loadThreads = useCallback(async () => {
    setIsLoadingThreads(true);
    setError(null);
    try {
      const data = await fetchThreads({ limit: 50 });
      if (mountedRef.current) {
        setThreads(data.threads || []);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || 'Failed to load threads');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoadingThreads(false);
      }
    }
  }, []);

  const openThread = useCallback(async (id) => {
    setIsLoadingMessages(true);
    setError(null);
    try {
      const threadData = await getThread(id);
      const messagesData = await fetchMessages(id, { limit: 200 });
      if (mountedRef.current) {
        setActiveThread(threadData.thread);
        setMessages(messagesData.messages || []);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || 'Failed to open thread');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoadingMessages(false);
      }
    }
  }, []);

  const startNewThread = useCallback(async (title) => {
    setError(null);
    try {
      const data = await createThread({ title: title || 'New Chat' });
      if (mountedRef.current) {
        setThreads((prev) => [data.thread, ...prev]);
        setActiveThread(data.thread);
        setMessages([]);
      }
      return data.thread;
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || 'Failed to create thread');
      }
      return null;
    }
  }, []);

  const renameThread = useCallback(async (id, title) => {
    setError(null);
    try {
      const data = await updateThread(id, { title });
      if (mountedRef.current) {
        setThreads((prev) =>
          prev.map((t) => (t.id === id ? data.thread : t)),
        );
        if (activeThread && activeThread.id === id) {
          setActiveThread(data.thread);
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || 'Failed to rename thread');
      }
    }
  }, [activeThread]);

  const removeThread = useCallback(async (id) => {
    setError(null);
    try {
      await deleteThread(id);
      if (mountedRef.current) {
        setThreads((prev) => prev.filter((t) => t.id !== id));
        if (activeThread && activeThread.id === id) {
          setActiveThread(null);
          setMessages([]);
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || 'Failed to delete thread');
      }
    }
  }, [activeThread]);

  const sendMessage = useCallback(async (content, sender = 'user') => {
    if (!activeThread) {
      setError('No active thread');
      return null;
    }
    setIsSending(true);
    setError(null);
    try {
      const data = await addMessage(activeThread.id, { content, sender });
      if (mountedRef.current) {
        setMessages((prev) => [...prev, data.message]);
      }
      return data.message;
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || 'Failed to send message');
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setIsSending(false);
      }
    }
  }, [activeThread]);

  const cleanup = useCallback(() => {
    mountedRef.current = false;
  }, []);

  const value = useMemo(
    () => ({
      threads,
      activeThread,
      messages,
      isLoadingThreads,
      isLoadingMessages,
      isSending,
      error,
      loadThreads,
      openThread,
      startNewThread,
      renameThread,
      removeThread,
      sendMessage,
      clearError,
      cleanup,
    }),
    [
      threads, activeThread, messages,
      isLoadingThreads, isLoadingMessages, isSending, error,
      loadThreads, openThread, startNewThread,
      renameThread, removeThread, sendMessage, clearError, cleanup,
    ],
  );

  return value;
}
