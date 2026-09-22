// @system — Onboarding progress checklist
// Compact, persistent checklist that tracks user progress through setup tasks.
// Can be collapsed/expanded and dismissed when complete.

import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, X, Trophy } from 'lucide-react'
import { cn } from '@/app/lib/@system/utils'
import { Card } from '../../Card'
import { Badge } from '../../Badge'

export function ProgressChecklist({
  title = 'Getting Started',
  tasks = [],
  onTaskClick,
  onDismiss,
  initialCollapsed = false,
  showProgress = true,
  className
}) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed)
  const [isDismissed, setIsDismissed] = useState(false)

  const completedTasks = tasks.filter(t => t.completed).length
  const totalTasks = tasks.length
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const allComplete = completedTasks === totalTasks && totalTasks > 0

  if (isDismissed) return null

  const handleDismiss = () => {
    setIsDismissed(true)
    onDismiss?.()
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between p-4 hover:bg-brand-surface-hover transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            allComplete ? 'bg-brand-primary text-brand-text-on-primary' : 'bg-brand-primary/10 text-brand-primary'
          )}>
            {allComplete ? (
              <Trophy className="h-4 w-4" />
            ) : (
              <span className="text-sm font-bold">{completedTasks}/{totalTasks}</span>
            )}
          </div>
          
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">{title}</h4>
              {allComplete && (
                <Badge variant="secondary" className="text-xs">
                  Complete!
                </Badge>
              )}
            </div>
            {showProgress && !isCollapsed && (
              <p className="text-xs text-brand-text-muted mt-0.5">
                {progress}% complete
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {allComplete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDismiss()
              }}
              className="text-brand-text-muted hover:text-brand-text transition-colors p-1"
              aria-label="Dismiss checklist"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4 text-brand-text-muted" />
          ) : (
            <ChevronUp className="h-4 w-4 text-brand-text-muted" />
          )}
        </div>
      </button>

      {/* Progress bar */}
      {!isCollapsed && showProgress && (
        <div className="px-4 pb-3">
          <div className="h-2 bg-brand-surface rounded-full overflow-hidden">
            <div 
              className="h-full bg-brand-primary transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Task list */}
      {!isCollapsed && (
        <div className="px-4 pb-4 space-y-2">
          {tasks.map((task, index) => {
            const Icon = task.icon
            
            return (
              <button
                key={index}
                onClick={() => !task.completed && onTaskClick?.(task)}
                disabled={task.completed}
                className={cn(
                  'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all',
                  task.completed
                    ? 'bg-brand-surface cursor-default'
                    : 'hover:bg-brand-surface-hover cursor-pointer'
                )}
              >
                {/* Checkbox */}
                <div
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors mt-0.5',
                    task.completed
                      ? 'border-primary bg-brand-primary'
                      : 'border-muted-foreground/40'
                  )}
                >
                  {task.completed && <Check className="h-3.5 w-3.5 text-brand-text-on-primary" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    {Icon && <Icon className="h-4 w-4 mt-0.5 shrink-0 text-brand-text-muted" />}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm font-medium',
                        task.completed && 'line-through text-brand-text-muted'
                      )}>
                        {task.title}
                      </p>
                      {task.description && !task.completed && (
                        <p className="text-xs text-brand-text-muted mt-1">
                          {task.description}
                        </p>
                      )}
                      {task.estimatedTime && !task.completed && (
                        <p className="text-xs text-brand-text-muted mt-1">
                          ~{task.estimatedTime}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// Example tasks with icons:
// import { User, CreditCard, Settings, Users } from 'lucide-react'
// 
// const tasks = [
//   {
//     id: 'profile',
//     title: 'Complete your profile',
//     description: 'Add your photo and bio',
//     icon: User,
//     completed: false,
//     estimatedTime: '2 min'
//   },
//   {
//     id: 'billing',
//     title: 'Set up billing',
//     description: 'Add a payment method',
//     icon: CreditCard,
//     completed: false,
//     estimatedTime: '3 min'
//   },
//   {
//     id: 'preferences',
//     title: 'Configure preferences',
//     description: 'Customize your experience',
//     icon: Settings,
//     completed: true,
//     estimatedTime: '1 min'
//   },
//   {
//     id: 'invite',
//     title: 'Invite team members',
//     description: 'Collaborate with your team',
//     icon: Users,
//     completed: false,
//     estimatedTime: '2 min'
//   }
// ]
