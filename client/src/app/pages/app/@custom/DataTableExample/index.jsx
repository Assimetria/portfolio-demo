// @custom — DataTable usage example
// Reference template showing the reusable @system DataTable with
// pagination, sorting, and filtering enabled. Copy this pattern into
// product-specific pages that need tabular data.
import { DataTable } from '@/app/components/@system/Dashboard/DataTable'

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'role', label: 'Role', sortable: true },
  { key: 'status', label: 'Status' },
]

const sampleData = Array.from({ length: 42 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  role: i % 3 === 0 ? 'Admin' : 'Member',
  status: i % 4 === 0 ? 'Invited' : 'Active',
}))

export function DataTableExample() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Data Table Example</h1>
        <p className="text-brand-text-muted text-sm">
          Reusable table with pagination, sorting, and filtering.
        </p>
      </div>
      <DataTable
        columns={columns}
        data={sampleData}
        searchable
        paginated
        pageSize={10}
      />
    </div>
  )
}

export default DataTableExample
