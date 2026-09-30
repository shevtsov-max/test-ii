/**
 * Фабрики объектов древа и справочники (типы событий, статусы отношений, типы мест…).
 * Структура объектов описана в ./types.js.
 */
import { emptyDate } from './dates'

export const TREE_VERSION = 2

export const uid = (prefix = '') => prefix + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 8)

export const emptyPoint = () => ({ date: emptyDate(), placeId: null, citations: [] })

// ------------------------------------------------------------------ справочники
export const GENDERS = [
  { value: 'M', label: 'Мужской', short: 'М', noun: 'Мужчина' },
  { value: 'F', label: 'Женский', short: 'Ж', noun: 'Женщина' },
  { value: 'U', label: 'Неизвестно', short: '?', noun: 'Пол неизвестен' },
]
export const genderLabel = Object.fromEntries(GENDERS.map((g) => [g.value, g.noun]))

export const FAMILY_STATUSES = [
  { value: 'married', label: 'В браке', icon: 'sym_r_favorite', partner: ['Муж', 'Жена', 'Супруг(а)'] },
  { value: 'partners', label: 'Гражданский союз', icon: 'sym_r_handshake', partner: ['Партнёр', 'Партнёрша', 'Партнёр'] },
  { value: 'engaged', label: 'Помолвлены', icon: 'sym_r_diamond', partner: ['Жених', 'Невеста', 'Жених/невеста'] },
  { value: 'separated', label: 'Живут раздельно', icon: 'sym_r_call_split', partner: ['Муж', 'Жена', 'Супруг(а)'] },
  { value: 'divorced', label: 'В разводе', icon: 'sym_r_heart_broken', partner: ['Бывший муж', 'Бывшая жена', 'Бывший супруг'] },
  { value: 'widowed', label: 'Вдовство', icon: 'sym_r_local_florist', partner: ['Муж', 'Жена', 'Супруг(а)'] },
  { value: 'unknown', label: 'Неизвестно', icon: 'sym_r_help', partner: ['Партнёр', 'Партнёрша', 'Партнёр'] },
]
export const statusInfo = (s) => FAMILY_STATUSES.find((x) => x.value === s) ?? FAMILY_STATUSES[FAMILY_STATUSES.length - 1]
export const isExStatus = (s) => s === 'divorced' || s === 'separated'

/** Тип связи ребёнка с семьёй родителей (GEDCOM PEDI). */
export const CHILD_LINKS = [
  { value: 'birth', label: 'Кровный', short: 'кровн.' },
  { value: 'adopted', label: 'Усыновлён(а)', short: 'усын.' },
  { value: 'foster', label: 'Приёмный', short: 'приёмн.' },
  { value: 'step', label: 'Неродной (отчим/мачеха)', short: 'неродн.' },
  { value: 'guardian', label: 'Под опекой', short: 'опека' },
  { value: 'unknown', label: 'Неизвестно', short: '?' },
]
export const childLinkInfo = (v) => CHILD_LINKS.find((x) => x.value === v) ?? CHILD_LINKS[0]

/**
 * События жизни. `ged` — тег GEDCOM, `hint` — подсказка для описания.
 * Рождение и смерть хранятся отдельными полями персоны, брак и развод — в семье.
 */
export const EVENT_TYPES = [
  { value: 'baptism', label: 'Крещение', icon: 'sym_r_water_drop', ged: 'BAPM', hint: 'Храм, крёстные' },
  { value: 'education', label: 'Образование', icon: 'sym_r_school', ged: 'EDUC', hint: 'Учебное заведение, специальность' },
  { value: 'occupation', label: 'Работа, должность', icon: 'sym_r_work', ged: 'OCCU', hint: 'Должность, место работы' },
  { value: 'residence', label: 'Место жительства', icon: 'sym_r_home', ged: 'RESI', hint: 'Адрес или описание' },
  { value: 'military', label: 'Военная служба', icon: 'sym_r_military_tech', ged: '_MILT', hint: 'Род войск, звание, часть' },
  { value: 'award', label: 'Награда', icon: 'sym_r_workspace_premium', ged: '_AWRD', hint: 'Название награды' },
  { value: 'emigration', label: 'Эмиграция', icon: 'sym_r_flight_takeoff', ged: 'EMIG', hint: 'Куда и почему' },
  { value: 'immigration', label: 'Переезд, иммиграция', icon: 'sym_r_flight_land', ged: 'IMMI', hint: 'Откуда' },
  { value: 'census', label: 'Перепись, ревизия', icon: 'sym_r_fact_check', ged: 'CENS', hint: 'Какая перепись, запись' },
  { value: 'religion', label: 'Вероисповедание', icon: 'sym_r_church', ged: 'RELI', hint: 'Вероисповедание' },
  { value: 'nationality', label: 'Национальность', icon: 'sym_r_flag', ged: 'NATI', hint: 'Национальность' },
  { value: 'namechange', label: 'Смена фамилии/имени', icon: 'sym_r_badge', ged: '_NAMECH', hint: 'Прежнее и новое имя' },
  { value: 'illness', label: 'Болезнь, ранение', icon: 'sym_r_healing', ged: '_ILLN', hint: 'Описание' },
  { value: 'burial', label: 'Погребение', icon: 'sym_r_park', ged: 'BURI', hint: 'Кладбище, участок' },
  { value: 'custom', label: 'Другое событие', icon: 'sym_r_event_note', ged: 'EVEN', hint: 'Описание' },
]
export const eventTypeInfo = (t) => EVENT_TYPES.find((x) => x.value === t) ?? EVENT_TYPES[EVENT_TYPES.length - 1]
export const eventTitle = (e) => (e.type === 'custom' ? e.title || 'Событие' : eventTypeInfo(e.type).label)

export const PLACE_TYPES = [
  { value: 'country', label: 'Страна', icon: 'sym_r_public' },
  { value: 'region', label: 'Регион, губерния', icon: 'sym_r_map' },
  { value: 'district', label: 'Район, уезд', icon: 'sym_r_holiday_village' },
  { value: 'city', label: 'Город', icon: 'sym_r_location_city' },
  { value: 'village', label: 'Село, деревня', icon: 'sym_r_cottage' },
  { value: 'address', label: 'Адрес', icon: 'sym_r_signpost' },
  { value: 'church', label: 'Храм, приход', icon: 'sym_r_church' },
  { value: 'cemetery', label: 'Кладбище', icon: 'sym_r_park' },
  { value: 'other', label: 'Другое', icon: 'sym_r_location_on' },
]
export const placeTypeInfo = (t) => PLACE_TYPES.find((x) => x.value === t) ?? PLACE_TYPES[PLACE_TYPES.length - 1]

export const MEDIA_KINDS = [
  { value: 'photo', label: 'Фото', icon: 'sym_r_photo' },
  { value: 'document', label: 'Документ', icon: 'sym_r_description' },
  { value: 'audio', label: 'Аудио', icon: 'sym_r_mic' },
  { value: 'video', label: 'Видео', icon: 'sym_r_movie' },
  { value: 'other', label: 'Файл', icon: 'sym_r_attach_file' },
]
export const mediaKindInfo = (k) => MEDIA_KINDS.find((x) => x.value === k) ?? MEDIA_KINDS[MEDIA_KINDS.length - 1]

export const SOURCE_TYPES = [
  { value: 'metric', label: 'Метрическая книга', icon: 'sym_r_menu_book' },
  { value: 'revision', label: 'Ревизская сказка', icon: 'sym_r_list_alt' },
  { value: 'census', label: 'Перепись', icon: 'sym_r_fact_check' },
  { value: 'archive', label: 'Архивный документ', icon: 'sym_r_inventory_2' },
  { value: 'document', label: 'Личный документ', icon: 'sym_r_id_card' },
  { value: 'book', label: 'Книга, статья', icon: 'sym_r_auto_stories' },
  { value: 'website', label: 'Сайт, база данных', icon: 'sym_r_language' },
  { value: 'oral', label: 'Устный рассказ', icon: 'sym_r_record_voice_over' },
  { value: 'other', label: 'Другое', icon: 'sym_r_description' },
]
export const sourceTypeInfo = (t) => SOURCE_TYPES.find((x) => x.value === t) ?? SOURCE_TYPES[SOURCE_TYPES.length - 1]

export const CITATION_QUALITY = [
  { value: 3, label: 'Прямое свидетельство', short: 'прямое' },
  { value: 2, label: 'Косвенное свидетельство', short: 'косвенное' },
  { value: 1, label: 'Сомнительное', short: 'сомнит.' },
  { value: 0, label: 'Ненадёжное', short: 'ненадёжн.' },
]

export const PRIVACY_LEVELS = [
  { value: 'public', label: 'Всем, у кого есть доступ к древу', icon: 'sym_r_lock_open' },
  { value: 'family', label: 'Только участникам древа', icon: 'sym_r_group' },
  { value: 'private', label: 'Только мне (скрыто при экспорте)', icon: 'sym_r_lock' },
]

export const CUSTOM_FIELD_TYPES = [
  { value: 'text', label: 'Текст' },
  { value: 'number', label: 'Число' },
  { value: 'date', label: 'Дата' },
  { value: 'url', label: 'Ссылка' },
]

export const CLAN_COLORS = ['#C2410C', '#0F766E', '#7C3AED', '#B45309', '#1D4ED8', '#BE185D', '#15803D', '#4338CA', '#A16207', '#0E7490']

export const TITLES = ['Д-р', 'Проф.', 'Акад.', 'Св.', 'Кн.', 'Гр.', 'Ген.', 'Полк.', 'Кап.', 'Лейт.', 'Протоиерей', 'Купец', 'Мещанин']
export const SUFFIXES = ['старший', 'младший', 'I', 'II', 'III', 'IV']

// ------------------------------------------------------------------ фабрики
/** @returns {import('./types').Person} */
export function newPerson(patch = {}) {
  const now = Date.now()
  return {
    id: uid('p'),
    gender: 'U',
    firstName: '',
    middleName: '',
    lastName: '',
    birthName: '',
    nickname: '',
    title: '',
    suffix: '',
    clanId: null,
    living: true,
    birth: emptyPoint(),
    death: { ...emptyPoint(), cause: '' },
    residencePlaceId: null,
    occupation: '',
    email: '',
    phone: '',
    avatarId: null,
    note: '',
    biography: '',
    events: [],
    custom: {},
    citations: [],
    favorite: false,
    privacy: 'public',
    createdAt: now,
    updatedAt: now,
    ...patch,
  }
}

/** @returns {import('./types').Family} */
export function newFamily(patch = {}) {
  return {
    id: uid('f'),
    partners: [],
    status: 'married',
    marriage: emptyPoint(),
    divorce: emptyPoint(),
    children: [],
    childLinks: {},
    note: '',
    citations: [],
    ...patch,
  }
}

/** @returns {import('./types').LifeEvent} */
export function newEvent(patch = {}) {
  return { id: uid('e'), type: 'custom', title: '', date: emptyDate(), placeId: null, description: '', citations: [], ...patch }
}

/** @returns {import('./types').Place} */
export function newPlace(patch = {}) {
  return { id: uid('pl'), name: '', type: 'other', parentId: null, lat: null, lng: null, altNames: '', note: '', ...patch }
}

/** @returns {import('./types').Media} */
export function newMedia(patch = {}) {
  return {
    id: uid('m'),
    kind: 'photo',
    title: '',
    description: '',
    date: emptyDate(),
    placeId: null,
    personIds: [],
    sourceId: null,
    src: null,
    fileKey: null,
    thumb: null,
    mime: '',
    size: 0,
    createdAt: Date.now(),
    ...patch,
  }
}

/** @returns {import('./types').Source} */
export function newSource(patch = {}) {
  return { id: uid('s'), title: '', type: 'archive', author: '', repository: '', callNumber: '', url: '', date: emptyDate(), note: '', ...patch }
}

/** @returns {import('./types').Citation} */
export function newCitation(patch = {}) {
  return { id: uid('c'), sourceId: '', page: '', quality: 2, note: '', ...patch }
}

/** @returns {import('./types').Clan} */
export function newClan(patch = {}) {
  return { id: uid('cl'), name: '', color: CLAN_COLORS[0], description: '', ...patch }
}

/** @returns {import('./types').TreeData} */
export function newTree(patch = {}) {
  const now = Date.now()
  return {
    version: TREE_VERSION,
    id: uid('t'),
    name: 'Моё семейное древо',
    description: '',
    homePersonId: null,
    persons: {},
    families: {},
    places: {},
    media: {},
    sources: {},
    clans: {},
    customFields: [],
    createdAt: now,
    updatedAt: now,
    ...patch,
  }
}

/** Дочерняя связь ребёнка с семьёй (по умолчанию «кровный»). */
export const childLink = (family, childId) => family?.childLinks?.[childId] ?? 'birth'
