import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, Eye, Save, ArrowLeft, FileText } from 'lucide-react'
import { Button } from '../../../../components/@system/ui/button'
import { Input } from '../../../../components/@system/ui/input'
import { Textarea } from '../../../../components/@system/ui/textarea'
import { Label } from '../../../../components/@system/ui/label'
import { Switch } from '../../../../components/@system/ui/switch'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../../../components/@system/ui/select'
import { Card, CardContent } from '../../../../components/@system/Card'
import { Sidebar } from '../../../../components/@system/Sidebar'
import { PageLayout } from '../../../../components/@system/PageLayout'
import { api } from '../../../../lib/@system/api'
import { cn } from '../../../../lib/@system/utils'

const STATUS_COLORS = {
  draft: 'bg-brand-surface text-brand-text-muted',
  published: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  scheduled: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)]/30 dark:text-[var(--color-warning)]',
  archived: 'bg-zinc-100 text-brand-text-muted dark:bg-brand-surface dark:text-brand-text-muted',
}

const CATEGORIES = ['Product', 'Engineering', 'Design', 'Company', 'Tutorials']
const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'archived', label: 'Archived' },
]

function fmtDate(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function PostEditor({ post, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: post?.title || '', slug: post?.slug || '', excerpt: post?.excerpt || '',
    content: post?.content || '', category: post?.category || 'Company',
    author: post?.author || 'The Team', tags: Array.isArray(post?.tags) ? post.tags.join(', ') : '',
    status: post?.status || 'draft', featured: post?.featured || false,
    meta_title: post?.meta_title || '', meta_description: post?.meta_description || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'title' && !post) {
        next.slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      }
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true); setError('')
    try {
      await onSave({ ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) })
    } catch (err) { setError(err?.message || 'Failed to save') } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      {error && <div className="rounded-md bg-[var(--color-error-bg)] px-4 py-2 text-sm text-[var(--color-error)]">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Post title" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" value={form.slug} onChange={e => set('slug', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={form.category} onValueChange={v => set('category', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="author">Author</Label>
          <Input id="author" value={form.author} onChange={e => set('author', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input id="tags" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="engineering, security" />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pt-5">
          <Switch id="featured" checked={form.featured} onCheckedChange={v => set('featured', v)} />
          <Label htmlFor="featured">Featured post</Label>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="excerpt">Excerpt</Label>
        <Textarea id="excerpt" value={form.excerpt} onChange={e => set('excerpt', e.target.value)}
          rows={2} placeholder="Short summary" className="resize-y" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="content">Content (Markdown)</Label>
        <Textarea id="content" value={form.content} onChange={e => set('content', e.target.value)}
          rows={20} placeholder="## Write your post..." className="resize-y font-mono" />
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-brand-text-muted">SEO Metadata</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="meta_title">Meta Title</Label>
            <Input id="meta_title" value={form.meta_title} onChange={e => set('meta_title', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meta_description">Meta Description</Label>
            <Input id="meta_description" value={form.meta_description} onChange={e => set('meta_description', e.target.value)} />
          </div>
        </div>
      </details>
    </form>
  )
}

export function BlogManagementPage() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const q = statusFilter ? `?status=${statusFilter}` : ''
      const data = await api.get(`/admin/blog${q}`)
      setPosts(data.posts || [])
    } catch { setPosts([]) } finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { loadPosts() }, [loadPosts])

  async function handleCreate(body) { await api.post('/admin/blog', body); setEditing(null); loadPosts() }
  async function handleUpdate(body) { await api.patch(`/admin/blog/${editing.id}`, body); setEditing(null); loadPosts() }
  async function handleDelete(id) {
    if (!window.confirm('Delete this post?')) return
    await api.delete(`/admin/blog/${id}`); loadPosts()
  }

  if (editing !== null) {
    return (
      <PageLayout><Sidebar />
        <main id="main-content" className="flex-1 p-6 lg:p-8 max-w-4xl">
          <PostEditor post={editing === 'new' ? null : editing}
            onSave={editing === 'new' ? handleCreate : handleUpdate} onCancel={() => setEditing(null)} />
        </main>
      </PageLayout>
    )
  }

  return (
    <PageLayout><Sidebar />
      <main id="main-content" className="flex-1 p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-2xl font-bold">Blog Management</h1>
            <p className="text-sm text-brand-text-muted mt-1">Create, edit, and publish blog posts</p></div>
          <Button size="sm" onClick={() => setEditing('new')}><Plus className="h-4 w-4 mr-1" /> New Post</Button>
        </div>
        <div className="flex gap-1.5 mb-6">
          {['', 'draft', 'published', 'scheduled', 'archived'].map(s => (
            <button key={s} type="button" onClick={() => setStatusFilter(s)}
              className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === s ? 'bg-brand-primary text-brand-text-on-primary' : 'bg-brand-surface text-brand-text-muted hover:bg-brand-surface-hover/80')}>
              {s || 'All'}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="text-center py-12 text-brand-text-muted">Loading...</div>
        ) : posts.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 text-brand-text-muted mx-auto mb-4" />
            <p className="font-medium">No blog posts yet</p>
            <Button size="sm" className="mt-4" onClick={() => setEditing('new')}><Plus className="h-4 w-4 mr-1" /> Create Post</Button>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">{posts.map(post => (
            <Card key={post.id} className="hover:border-primary/40 transition-colors">
              <CardContent className="py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{post.title}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_COLORS[post.status])}>{post.status}</span>
                    {post.featured && <span className="rounded-full bg-brand-primary/10 text-brand-primary px-2 py-0.5 text-[10px] font-medium">Featured</span>}
                  </div>
                  <div className="text-xs text-brand-text-muted mt-0.5">
                    {post.category} &middot; {post.author} &middot; {fmtDate(post.published_at || post.created_at)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {post.status === 'published' && <Button variant="ghost" size="sm" asChild><a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer"><Eye className="h-4 w-4" /></a></Button>}
                  <Button variant="ghost" size="sm" onClick={() => setEditing(post)}><Edit2 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(post.id)}><Trash2 className="h-4 w-4 text-[var(--color-error)]" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}</div>
        )}
      </main>
    </PageLayout>
  )
}
