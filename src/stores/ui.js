import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  /** Быстрая форма добавления / редактирования */
  const personForm = ref({ open: false, mode: 'add', targetId: null, kind: null, personId: null })

  /** Полный профиль (вкладки) */
  const profile = ref({
    open: false,
    personId: null,
    tab: 'info',
  })

  const familyDialog = ref({ open: false, familyId: null })
  /** Оверлей «+» над карточкой */
  const addOverlayFor = ref(null)
  const settingsOpen = ref(false)
  const dataOpen = ref(false)
  const helpOpen = ref(false)
  const factDialog = ref({
    open: false,
    personId: null,
    factId: null,
  })

  function addRelative(targetId, kind, presetFamilyId = null) {
    addOverlayFor.value = null
    personForm.value = { open: true, mode: 'add', targetId, kind, personId: null, presetFamilyId }
  }
  function editPerson(personId) {
    personForm.value = { open: true, mode: 'edit', targetId: null, kind: null, personId }
  }
  function openProfile(personId, tab = 'info') {
    profile.value = { open: true, personId, tab }
  }
  function editFamily(familyId) {
    familyDialog.value = { open: true, familyId }
  }
  function editFact(personId, factId = null) {
    factDialog.value = { open: true, personId, factId }
  }

  return {
    personForm,
    profile,
    familyDialog,
    addOverlayFor,
    settingsOpen,
    dataOpen,
    helpOpen,
    factDialog,
    addRelative,
    editPerson,
    openProfile,
    editFamily,
    editFact,
  }
})
