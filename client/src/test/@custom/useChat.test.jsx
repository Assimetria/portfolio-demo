// @custom — Chat state management hook tests
// Exercises the useChat hook API contract: state shape, error handling,
// and the action dispatchers (loadThreads, openThread, sendMessage, etc.)

import { renderHook, act } from '@testing-library/react';
import { useChat } from '@/app/hooks/@custom/useChat';

// Mock the chat API client
jest.mock('@/app/api/@custom/chat', () => ({
  fetchThreads: jest.fn(),
  createThread: jest.fn(),
  getThread: jest.fn(),
  updateThread: jest.fn(),
  deleteThread: jest.fn(),
  fetchMessages: jest.fn(),
  addMessage: jest.fn(),
}));

import * as mockApi from '@/app/api/@custom/chat';

const MOCK_THREAD = {
  id: 1,
  user_id: 7,
  title: 'Test Chat',
  external_id: null,
  last_message_at: '2026-09-01T00:00:00.000Z',
  created_at: '2026-08-30T00:00:00.000Z',
};

const MOCK_THREAD_2 = {
  id: 2,
  user_id: 7,
  title: 'Another Chat',
  external_id: null,
  last_message_at: '2026-09-02T00:00:00.000Z',
  created_at: '2026-09-01T00:00:00.000Z',
};

const MOCK_MESSAGE = {
  id: 1,
  thread_id: 1,
  sender: 'user',
  content: 'Hello world',
  metadata: {},
  created_at: '2026-09-01T00:01:00.000Z',
};

const MOCK_MESSAGE_2 = {
  id: 2,
  thread_id: 1,
  sender: 'assistant',
  content: 'Hi there!',
  metadata: {},
  created_at: '2026-09-01T00:01:30.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('@custom useChat hook', () => {
  it('returns the expected initial state shape', () => {
    const { result } = renderHook(() => useChat());

    expect(result.current.threads).toEqual([]);
    expect(result.current.activeThread).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoadingThreads).toBe(false);
    expect(result.current.isLoadingMessages).toBe(false);
    expect(result.current.isSending).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.loadThreads).toBe('function');
    expect(typeof result.current.openThread).toBe('function');
    expect(typeof result.current.startNewThread).toBe('function');
    expect(typeof result.current.renameThread).toBe('function');
    expect(typeof result.current.removeThread).toBe('function');
    expect(typeof result.current.sendMessage).toBe('function');
    expect(typeof result.current.clearError).toBe('function');
  });

  it('loads threads and updates state', async () => {
    mockApi.fetchThreads.mockResolvedValue({
      threads: [MOCK_THREAD, MOCK_THREAD_2],
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.loadThreads();
    });

    expect(result.current.threads).toHaveLength(2);
    expect(result.current.threads[0].id).toBe(1);
    expect(result.current.threads[1].id).toBe(2);
    expect(result.current.isLoadingThreads).toBe(false);
  });

  it('handles loadThreads error', async () => {
    mockApi.fetchThreads.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.loadThreads();
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.isLoadingThreads).toBe(false);
  });

  it('opens a thread and loads messages', async () => {
    mockApi.getThread.mockResolvedValue({ thread: MOCK_THREAD });
    mockApi.fetchMessages.mockResolvedValue({
      messages: [MOCK_MESSAGE, MOCK_MESSAGE_2],
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.openThread(1);
    });

    expect(result.current.activeThread).toEqual(MOCK_THREAD);
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.isLoadingMessages).toBe(false);
  });

  it('starts a new thread and updates state', async () => {
    mockApi.createThread.mockResolvedValue({ thread: MOCK_THREAD });

    const { result } = renderHook(() => useChat());

    let thread;
    await act(async () => {
      thread = await result.current.startNewThread('My Chat');
    });

    expect(thread).toEqual(MOCK_THREAD);
    expect(result.current.activeThread).toEqual(MOCK_THREAD);
    expect(result.current.threads).toHaveLength(1);
    expect(result.current.messages).toEqual([]);
  });

  it('renames a thread', async () => {
    const updatedThread = { ...MOCK_THREAD, title: 'Renamed Chat' };
    mockApi.updateThread.mockResolvedValue({ thread: updatedThread });
    mockApi.createThread.mockResolvedValue({ thread: MOCK_THREAD });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.startNewThread('Old Title');
    });

    await act(async () => {
      await result.current.renameThread(1, 'Renamed Chat');
    });

    expect(result.current.threads[0].title).toBe('Renamed Chat');
  });

  it('removes a thread and clears active state', async () => {
    mockApi.deleteThread.mockResolvedValue({});
    mockApi.createThread.mockResolvedValue({ thread: MOCK_THREAD });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.startNewThread('To Delete');
    });

    await act(async () => {
      await result.current.removeThread(1);
    });

    expect(result.current.threads).toHaveLength(0);
    expect(result.current.activeThread).toBeNull();
    expect(result.current.messages).toEqual([]);
  });

  it('sends a message in the active thread', async () => {
    mockApi.addMessage.mockResolvedValue({ message: MOCK_MESSAGE });
    mockApi.createThread.mockResolvedValue({ thread: MOCK_THREAD });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.startNewThread('Chat');
    });

    await act(async () => {
      await result.current.sendMessage('Hello world');
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('Hello world');
    expect(result.current.isSending).toBe(false);
  });

  it('returns null when sendMessage is called with no active thread', async () => {
    const { result } = renderHook(() => useChat());

    let msg;
    await act(async () => {
      msg = await result.current.sendMessage('Hello');
    });

    expect(msg).toBeNull();
    expect(result.current.error).toBe('No active thread');
    expect(mockApi.addMessage).not.toHaveBeenCalled();
  });

  it('clears error state', async () => {
    mockApi.fetchThreads.mockRejectedValue(new Error('Test error'));

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.loadThreads();
    });

    expect(result.current.error).toBe('Test error');

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('cleanup prevents state updates after unmount', async () => {
    mockApi.fetchThreads.mockResolvedValue({
      threads: [MOCK_THREAD],
    });

    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.cleanup();
    });

    await act(async () => {
      await result.current.loadThreads();
    });

    expect(result.current.threads).toEqual([]);
  });
});
