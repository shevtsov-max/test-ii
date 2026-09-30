import { defineStore } from 'pinia'
import { ref } from 'vue'

/** Состояние диалогов и временных панелей. */
export const useUiStore = defineStore('ui', () => {
  const personEditor = ref({ open: false, personId: null, tab: 'main' })
  const relativeDialog = ref({ open: false, targetId: null, kind: null, familyId: null, link: null })
  const familyDialog = ref({ open: false, familyId: null })
  const eventDialog = ref({ open: false, personId: null, eventId: null, type: null })
  const mediaViewer = ref({ open: false, ids: [], index: 0 })
  const mediaEditor = ref({ open: false, mediaId: null })
  const placeDialog = ref({ open: false, placeId: null, parentId: null })
  const sourceDialog = ref({ open: false, sourceId: null })
  const mergeDialog = ref({ open: false, a: null, b: null })
  const kinshipDialog = ref({ open: false, a: null, b: null })
  const commandOpen = ref(false)
  const shortcutsOpen = ref(false)
  const whatsNewOpen = ref(false)
  /** Оверлей «+» над карточкой в древе */
  const addOverlayFor = ref(null)

  const editPerson = (personId, tab = 'main') => (personEditor.value = { open: true, personId, tab })
  const newPerson = () => (personEditor.value = { open: true, personId: null, tab: 'main' })
  const addRelative = (targetId, kind, familyId = null, link = null) => {
    addOverlayFor.value = null
    relativeDialog.value = { open: true, targetId, kind, familyId, link }
  }
  const editFamily = (familyId) => (familyDialog.value = { open: true, familyId })
  const editEvent = (personId, eventId = null, type = null) => (eventDialog.value = { open: true, personId, eventId, type })
  const viewMedia = (ids, index = 0) => (mediaViewer.value = { open: true, ids, index })
  const editMedia = (mediaId) => (mediaEditor.value = { open: true, mediaId })
  const editPlace = (placeId = null, parentId = null) => (placeDialog.value = { open: true, placeId, parentId })
  const editSource = (sourceId = null) => (sourceDialog.value = { open: true, sourceId })
  const merge = (a, b) => (mergeDialog.value = { open: true, a, b })
  const kinship = (a = null, b = null) => (kinshipDialog.value = { open: true, a, b })

  return {
    personEditor,
    relativeDialog,
    familyDialog,
    eventDialog,
    mediaViewer,
    mediaEditor,
    placeDialog,
    sourceDialog,
    mergeDialog,
    kinshipDialog,
    commandOpen,
    shortcutsOpen,
    whatsNewOpen,
    addOverlayFor,
    editPerson,
    newPerson,
    addRelative,
    editFamily,
    editEvent,
    viewMedia,
    editMedia,
    editPlace,
    editSource,
    merge,
    kinship,
  }
})
