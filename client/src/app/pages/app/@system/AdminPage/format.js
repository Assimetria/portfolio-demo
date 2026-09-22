// @system — AdminPage date formatting helper (shared by the admin tabs)
export function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric' })
}
