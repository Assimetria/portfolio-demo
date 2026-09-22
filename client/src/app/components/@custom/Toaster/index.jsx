// @custom — Toaster container: renders queued toasts from the useToast store.
//
// Mount once near the root of the app (see App.jsx). Consumers trigger toasts
// with `toast(...)` or `useToast()` from '@/app/hooks/@custom/useToast'.

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '../../@system/ui/toast'
import { useToast } from '@/app/hooks/@custom/useToast'

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, ...props }) => (
        <Toast key={id} {...props}>
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          {action}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}

export default Toaster
