// Модель данных описана JSDoc-typedef'ами — только для подсказок в редакторе, в рантайме файл ничего не экспортирует.

/** @typedef {'M' | 'F' | 'U'} Gender */

/** @typedef {'exact' | 'about' | 'before' | 'after' | 'between' | 'estimated'} DateQualifier */

/**
 * @typedef {object} GDate
 * @property {DateQualifier} qualifier
 * @property {number | null} [day]
 * @property {number | null} [month]
 * @property {number | null} [year]
 * @property {number | null} [day2] Вторая граница для «между»
 * @property {number | null} [month2]
 * @property {number | null} [year2]
 */

/**
 * @typedef {object} LifeEvent
 * @property {GDate} date
 * @property {string} place
 */

/** @typedef {'baptism' | 'education' | 'occupation' | 'residence' | 'military' | 'emigration' | 'immigration' | 'burial' | 'religion' | 'nationality' | 'award' | 'custom'} FactType */

/**
 * @typedef {object} Fact
 * @property {string} id
 * @property {FactType} type
 * @property {string} [title]
 * @property {GDate} date
 * @property {string} place
 * @property {string} description
 */

/**
 * @typedef {object} Photo
 * @property {string} id
 * @property {string} src URL или data-URL
 * @property {string} caption
 * @property {number} addedAt
 */

/**
 * @typedef {object} Person
 * @property {string} id
 * @property {Gender} gender
 * @property {string} firstName
 * @property {string} middleName
 * @property {string} lastName
 * @property {string} birthName
 * @property {string} nickname
 * @property {string} title
 * @property {string} suffix
 * @property {boolean} living
 * @property {LifeEvent} birth
 * @property {LifeEvent & { cause: string }} death
 * @property {string} email
 * @property {string} phone
 * @property {string | null} avatarId Главное фото (id из photos)
 * @property {Photo[]} photos
 * @property {string} biography
 * @property {Fact[]} facts
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/** @typedef {'married' | 'partners' | 'engaged' | 'divorced' | 'separated' | 'widowed' | 'unknown'} FamilyStatus */

/**
 * @typedef {object} Family
 * @property {string} id
 * @property {string[]} partners Партнёры (0–2). Порядок не важен, для отрисовки мужчина слева.
 * @property {FamilyStatus} status
 * @property {LifeEvent} marriage
 * @property {LifeEvent} divorce
 * @property {string[]} children
 */

/**
 * @typedef {object} TreeData
 * @property {1} version
 * @property {string} id
 * @property {string} name
 * @property {string | null} homePersonId
 * @property {Record<string, Person>} persons
 * @property {Record<string, Family>} families
 */

/** @typedef {'father' | 'mother' | 'brother' | 'sister' | 'partner' | 'son' | 'daughter'} RelativeKind */

/** @typedef {'family' | 'pedigree' | 'fan' | 'list'} ViewMode */

export {}
