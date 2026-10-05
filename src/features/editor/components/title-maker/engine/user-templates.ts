import type { UserSavedTemplate } from '../types'

const STORAGE_KEY = 'freecut_title_maker_user_templates_v1'

export function getUserTemplates(): UserSavedTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveUserTemplates(templates: UserSavedTemplate[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  } catch (e) {
    console.error('Failed to save user templates to localStorage', e)
  }
}
