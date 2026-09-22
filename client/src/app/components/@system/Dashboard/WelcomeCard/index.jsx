// @system — Dashboard welcome card with onboarding checklist
// Shows a friendly welcome message and tracks user progress through key setup tasks.
// Auto-hides when all tasks are complete.

import { useState } from 'react'
import { X, Check, ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'
import { Card } from '../../Card'

export function WelcomeCard({
  user,
  tasks = [],
  onTaskClick,
  onDismiss,
  className
}) {
  const [dismissed, setDismissed] = useState(false)
  
  const completedTasks = tasks.filter(t => t.completed).length
  const totalTasks = tasks.length
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
  const allComplete = completedTasks === totalTasks

  // Auto-hide if all tasks complete and user clicked dismiss before
  if (dismissed || (allComplete && totalTasks > 0)) {
    return null
  }

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  return (
    <Card className={cn('relative overflow-hidden border-2', className)}>
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      
      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary/10">
              <Sparkles className="h-6 w-6 text-brand-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">
                Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋
              </h3>
              <p className="text-sm text-brand-text-muted">
                {allComplete 
                  ? "You're all set! Time to explore." 
                  : `${completedTasks} of ${totalTasks} tasks complete`}
              </p>
            </div>
          </div>
          
          {onDismiss && (
            <button
              onClick={handleDismiss}
              className="text-brand-text-muted hover:text-brand-text transition-colors p-1"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        {totalTasks > 0 && (
          <div className="mb-4">
            <div className="h-2 bg-brand-surface rounded-full overflow-hidden">
              <div 
                className="h-full bg-brand-primary transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Task list */}
        {tasks.length > 0 && (
          <div className="space-y-2">
            {tasks.map((task, index) => (
              <button
                key={index}
                onClick={() => !task.completed && onTaskClick?.(task)}
                disabled={task.completed}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all',
                  task.completed
                    ? 'bg-brand-surface cursor-default'
                    : 'bg-brand-surface hover:bg-brand-surface-hover/60 cursor-pointer'
                )}
              >
                <div
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    task.completed
                      ? 'border-primary bg-brand-primary'
                      : 'border-muted-foreground/40'
                  )}
                >
                  {task.completed && <Check className="h-3 w-3 text-brand-text-on-primary" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-medium',
                    task.completed && 'line-through text-brand-text-muted'
                  )}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="text-xs text-brand-text-muted mt-0.5">
                      {task.description}
                    </p>
                  )}
                </div>
                
                {!task.completed && (
                  <ChevronRight className="h-4 w-4 text-brand-text-muted shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

// Example tasks structure:
// const tasks = [
//   { 
//     id: 'profile', 
//     title: 'Complete your profile',
//     description: 'Add a photo and bio',
//     completed: false,
//     action: () => navigate('/app/settings')
//   },
//   { 
//     id: 'billing', 
//     title: 'Add payment method',
//     description: 'Get started with a free trial',
//     completed: false,
//     action: () => navigate('/app/billing')
//   },
// ]
