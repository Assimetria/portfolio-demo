// @custom — Portfolio Projects page
// Displays authenticated user's portfolio projects with create/edit/delete actions
import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
} from 'lucide-react'
import { DashboardLayout } from '@/app/components/@system/Dashboard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/@system/ui/card'
import { Button } from '@/app/components/@system/ui/button'
import { Input } from '@/app/components/@system/ui/input'
import { Label } from '@/app/components/@system/ui/label'
import { Textarea } from '@/app/components/@system/ui/textarea'
import { Badge } from '@/app/components/@system/ui/badge'
import { LoadingSpinner } from '@/app/components/@custom/LoadingSpinner'
import { getPortfolioProjects, createPortfolioProject, updatePortfolioProject, deletePortfolioProject } from '@/app/api/@custom'

const EMPTY_FORM = { title: '', description: '', category: '', tags: '', project_url: '', image_url: '' }

export function PortfolioProjectsPage() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getPortfolioProjects()
      setProjects(res?.projects ?? res?.data ?? [])
    } catch (err) {
      setError(err.body?.message || err.message || 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        await updatePortfolioProject(editingId, form)
      } else {
        await createPortfolioProject(form)
      }
      setForm(EMPTY_FORM)
      setShowForm(false)
      setEditingId(null)
      await fetchProjects()
    } catch (err) {
      setError(err.body?.message || err.message || 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(project) {
    setEditingId(project.id)
    setForm({
      title: project.title || '',
      description: project.description || '',
      category: project.category || '',
      tags: Array.isArray(project.tags) ? project.tags.join(', ') : (project.tags || ''),
      project_url: project.project_url || '',
      image_url: project.image_url || '',
    })
    setShowForm(true)
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this project?')) return
    try {
      await deletePortfolioProject(id)
      await fetchProjects()
    } catch (err) {
      setError(err.body?.message || err.message || 'Failed to delete project')
    }
  }

  function handleCancel() {
    setForm(EMPTY_FORM)
    setShowForm(false)
    setEditingId(null)
  }

  return (
    <DashboardLayout>
      <DashboardLayout.Content>
        <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
          <header className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-brand-text">Portfolio Projects</h1>
              <p className="mt-1 text-sm text-brand-text-muted">
                Manage your portfolio project showcase.
              </p>
            </div>
            <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM) }}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              New Project
            </Button>
          </header>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
            </div>
          )}

          {showForm && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>{editingId ? 'Edit Project' : 'New Project'}</CardTitle>
                <CardDescription>
                  {editingId ? 'Update the project details below.' : 'Fill in the details to add a new portfolio project.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input id="title" name="title" value={form.title} onChange={handleFormChange} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" value={form.description} onChange={handleFormChange} rows={3} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Input id="category" name="category" value={form.category} onChange={handleFormChange} placeholder="e.g. Web App, Mobile" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tags">Tags (comma-separated)</Label>
                      <Input id="tags" name="tags" value={form.tags} onChange={handleFormChange} placeholder="react, node, postgres" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="project_url">Project URL</Label>
                      <Input id="project_url" name="project_url" value={form.project_url} onChange={handleFormChange} placeholder="https://..." />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="image_url">Image URL</Label>
                      <Input id="image_url" name="image_url" value={form.image_url} onChange={handleFormChange} placeholder="https://..." />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button type="submit" disabled={saving || !form.title.trim()}>
                      {saving ? 'Saving...' : (editingId ? 'Update' : 'Create')}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <LoadingSpinner label="Loading projects..." />
          ) : projects.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No projects yet</CardTitle>
                <CardDescription>Create your first portfolio project to showcase your work.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Card key={project.id} className="overflow-hidden">
                  {project.image_url && (
                    <div className="aspect-video w-full overflow-hidden bg-brand-surface">
                      <img
                        src={project.image_url}
                        alt={project.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">{project.title}</CardTitle>
                        {project.category && (
                          <Badge variant="secondary" className="mt-1">{project.category}</Badge>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(project)} aria-label="Edit project">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(project.id)} aria-label="Delete project">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {project.description && (
                      <p className="text-sm text-brand-text-muted line-clamp-2">{project.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(project.tags) && project.tags.map((tag, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                    {project.project_url && (
                      <a
                        href={project.project_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-brand-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        View Project
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout.Content>
    </DashboardLayout>
  )
}

export default PortfolioProjectsPage
