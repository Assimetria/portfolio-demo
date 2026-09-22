// @system — tab component with mobile scroll wrapper
// Re-exports shadcn ui/tabs with a mobile-friendly TabsList that scrolls horizontally
import { cn } from '@/app/lib/@system/utils'
import {
  Tabs as TabsRoot,
  TabsList as TabsListBase,
  TabsTrigger,
  TabsContent,
} from '../ui/tabs'

const Tabs = TabsRoot

function TabsList({ className, ...props }) {
  return (
    <div className="w-full overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 scrollbar-none">
      <TabsListBase
        className={cn('inline-flex justify-start sm:justify-center min-w-min', className)}
        {...props}
      />
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
