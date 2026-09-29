import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RelativeKind } from '@/types'

export type ProfileTab = 'info' | 'facts' | 'bio' | 'photos' | 'relatives'

export const useUiStore = defineStore('ui', () => {
  /** Быстрая форма добавления / редактирования */
  const personForm = ref<{
    open: boolean
    mode: 'add' | 'edit'
    targetId: string | null
    kind: RelativeKind | null
    personId: string | null
    presetFamilyId?: string | null
  }>({ open: false, mode: 'add', targetId: null, kind: null, personId: null })

  /** Полный профиль (вкладки) */
  const profile = ref<{ open: boolean; personId: string | null; tab: ProfileTab }>({
    open: false,
    personId: null,
    tab: 'info',
  })

  const familyDialog = ref<{ open: boolean; familyId: string | null }>({ open: false, familyId: null })
  /** Оверлей «+» над карточкой */
  const addOverlayFor = ref<string | null>(null)
  const settingsOpen = ref(false)
  const dataOpen = ref(false)
  const helpOpen = ref(false)
  const factDialog = ref<{ open: boolean; personId: string | null; factId: string | null }>({
    open: false,
    personId: null,
    factId: null,
  })

  function addRelative(targetId: string, kind: RelativeKind, presetFamilyId: string | null = null) {
    addOverlayFor.value = null
    personForm.value = { open: true, mode: 'add', targetId, kind, personId: null, presetFamilyId }
  }
  function editPerson(personId: string) {
    personForm.value = { open: true, mode: 'edit', targetId: null, kind: null, personId }
  }
  function openProfile(personId: string, tab: ProfileTab = 'info') {
    profile.value = { open: true, personId, tab }
  }
  function editFamily(familyId: string) {
    familyDialog.value = { open: true, familyId }
  }
  function editFact(personId: string, factId: string | null = null) {
    factDialog.value = { open: true, personId, factId }
  }

  return {
    personForm, profile, familyDialog, addOverlayFor, settingsOpen, dataOpen, helpOpen, factDialog,
    addRelative, editPerson, openProfile, editFamily, editFact,
  }
})
