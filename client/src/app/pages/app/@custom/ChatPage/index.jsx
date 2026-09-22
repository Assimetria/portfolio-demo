// @custom — Chat page component
// Demonstrates the useChat hook for chat state management.
// Provides a thread sidebar and message area for AI chat interactions.

import { useEffect } from 'react';
import { useChat } from '@/app/hooks/@custom/useChat';
import { Button } from '@/app/components/@system/ui/Button';
import { Input } from '@/app/components/@system/ui/Input';
import { LoadingSpinner } from '@/app/components/@custom/LoadingSpinner';
import { MessageSquare, Plus, Trash2, Edit3 } from 'lucide-react';

export default function ChatPage() {
  const {
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
  } = useChat();

  useEffect(() => {
    loadThreads();
    return () => {
      cleanup();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewThread = async () => {
    await startNewThread();
    await loadThreads();
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const form = e.target;
    const input = form.elements.message;
    const content = input.value.trim();
    if (!content) return;
    await sendMessage(content);
    input.value = '';
  };

  const handleRename = async (id, currentTitle) => {
    const newTitle = window.prompt('Rename thread:', currentTitle);
    if (newTitle && newTitle.trim()) {
      await renameThread(id, newTitle.trim());
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this thread?')) {
      await removeThread(id);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-brand-bg">
      <aside className="w-72 border-r border-brand-border flex flex-col bg-brand-surface">
        <div className="p-3 border-b border-brand-border">
          <Button
            onClick={handleNewThread}
            className="w-full flex items-center justify-center gap-2"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        {isLoadingThreads ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <p className="p-4 text-sm text-brand-text-muted text-center">
                No conversations yet
              </p>
            ) : (
              <ul className="py-1" data-testid="thread-list">
                {threads.map((thread) => (
                  <li key={thread.id}>
                    <button
                      type="button"
                      onClick={() => openThread(thread.id)}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-brand-surface-hover transition-colors ${
                        activeThread && activeThread.id === thread.id
                          ? 'bg-brand-surface-hover'
                          : ''
                      }`}
                    >
                      <MessageSquare className="h-4 w-4 shrink-0 text-brand-text-muted" />
                      <span className="truncate flex-1">{thread.title}</span>
                      <span className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRename(thread.id, thread.title);
                          }}
                          className="p-1 rounded hover:bg-brand-bg"
                          aria-label="Rename thread"
                          data-testid="rename-thread-btn"
                        >
                          <Edit3 className="h-3 w-3 text-brand-text-muted" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(thread.id);
                          }}
                          className="p-1 rounded hover:bg-brand-bg"
                          aria-label="Delete thread"
                          data-testid="delete-thread-btn"
                        >
                          <Trash2 className="h-3 w-3 text-brand-text-muted" />
                        </button>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </aside>

      <main className="flex-1 flex flex-col bg-brand-bg">
        {!activeThread ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-brand-text-muted" />
              <h2 className="text-lg font-semibold text-brand-text mb-2">
                Chat
              </h2>
              <p className="text-sm text-brand-text-muted">
                Select a conversation or start a new one
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-brand-border bg-brand-surface">
              <h1 className="font-semibold text-brand-text">
                {activeThread.title}
              </h1>
            </div>

            <div
              className="flex-1 overflow-y-auto p-4 space-y-4"
              data-testid="messages-container"
            >
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <LoadingSpinner />
                </div>
              ) : messages.length === 0 ? (
                <p className="text-sm text-brand-text-muted text-center">
                  No messages yet. Start the conversation!
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.sender === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                        msg.sender === 'user'
                          ? 'bg-brand-primary text-brand-text-on-primary'
                          : 'bg-brand-surface text-brand-text'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>

            {error && (
              <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-700 text-sm flex items-center justify-between">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={clearError}
                  className="text-red-500 hover:text-red-700"
                >
                  Dismiss
                </button>
              </div>
            )}

            <form
              onSubmit={handleSendMessage}
              className="p-4 border-t border-brand-border bg-brand-surface"
            >
              <div className="flex gap-2">
                <Input
                  name="message"
                  placeholder="Type a message..."
                  disabled={isSending}
                  className="flex-1"
                  data-testid="message-input"
                />
                <Button type="submit" disabled={isSending}>
                  {isSending ? 'Sending...' : 'Send'}
                </Button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
