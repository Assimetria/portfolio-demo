// @system — Profile settings component
// Manage user profile information: name, email, avatar, bio

import { useState } from 'react'
import { Camera, Mail, User as UserIcon, Trash2 } from 'lucide-react'
import { SettingsSection, SettingsRow } from '../'
import { Button } from '../../Button'
import { Form, FormField, FormLabel, Input as FormInput, Textarea as FormTextarea } from '../../Form'
import { Avatar } from '../../Avatar'
import { cn } from '@/app/lib/@system/utils'

export function ProfileSettings({ user, onUpdate }) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    bio: user?.bio || '',
    avatar: user?.avatar || '',
  })

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onUpdate?.(formData)
      // Show success toast
    } catch (error) {
      // Show error toast
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Handle file upload logic here
    // const url = await uploadAvatar(file)
    // setFormData(prev => ({ ...prev, avatar: url }))
  }

  return (
    <div className="max-w-2xl">
      <SettingsSection
        title="Public profile"
        description="This information will be visible to other users"
      >
        <Form onSubmit={handleSubmit}>
          {/* Avatar upload */}
          <div className="mb-6">
            <FormLabel htmlFor="avatar">Profile picture</FormLabel>
            <div className="flex items-center gap-4 mt-2">
              <Avatar
                src={formData.avatar}
                alt={formData.name}
                size="lg"
                fallback={formData.name?.[0]?.toUpperCase() || 'U'}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('avatar-upload')?.click()}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Upload
                </Button>
                {formData.avatar && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData((prev) => ({ ...prev, avatar: '' }))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>
            </div>
          </div>

          {/* Name */}
          <FormField>
            <FormLabel htmlFor="name">Full name</FormLabel>
            <FormInput
              id="name"
              type="text"
              value={formData.name}
              onChange={handleChange('name')}
              placeholder="John Doe"
              required
            />
          </FormField>

          {/* Email */}
          <FormField>
            <FormLabel htmlFor="email">Email address</FormLabel>
            <FormInput
              id="email"
              type="email"
              value={formData.email}
              onChange={handleChange('email')}
              placeholder="john@example.com"
              required
              disabled // Usually can't change email directly
            />
            <p className="text-xs text-brand-text-muted mt-1">
              Contact support to change your email address
            </p>
          </FormField>

          {/* Bio */}
          <FormField>
            <FormLabel htmlFor="bio">Bio</FormLabel>
            <FormTextarea
              id="bio"
              value={formData.bio}
              onChange={handleChange('bio')}
              placeholder="Tell us a bit about yourself..."
              rows={4}
              maxLength={160}
            />
            <p className="text-xs text-brand-text-muted mt-1">
              {formData.bio.length}/160 characters
            </p>
          </FormField>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormData({
                name: user?.name || '',
                email: user?.email || '',
                bio: user?.bio || '',
                avatar: user?.avatar || '',
              })}
            >
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Save changes
            </Button>
          </div>
        </Form>
      </SettingsSection>

      {/* Danger zone */}
      <SettingsSection
        title="Danger zone"
        description="Permanent actions that cannot be undone"
      >
        <div className="rounded-lg border border-[var(--color-error)]/20 bg-[var(--color-error)]/5 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-error)]">Delete account</h4>
              <p className="text-xs text-brand-text-muted mt-1">
                Permanently delete your account and all associated data
              </p>
            </div>
            <Button variant="destructive" size="sm">
              Delete account
            </Button>
          </div>
        </div>
      </SettingsSection>
    </div>
  )
}
