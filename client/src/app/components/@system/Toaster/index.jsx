// @system — Toaster container using shadcn Toast primitives
import { ToastProvider, ToastViewport } from '../ui/toast'

export function Toaster() {
  return (
    <ToastProvider>
      <ToastViewport />
    </ToastProvider>
  )
}
