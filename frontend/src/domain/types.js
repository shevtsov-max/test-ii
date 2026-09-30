// Модель данных древа (версия 2) описана JSDoc-typedef'ами — только для подсказок в редакторе.
// В рантайме файл ничего не экспортирует. Фабрики объектов — в ./model.js, миграция старых данных — в ./migrate.js.
//
// Древо хранится нормализованно (как в кэше GraphQL): коллекции `Record<id, Entity>`, связи — по id.
// Объекты древа неизменяемы: стор меняет их через immer (`tree.commit(label, draft => …)`), поэтому
// снимки для «Отменить» и изменения для синхронизации с сервером получаются дёшево.

/** @typedef {'M' | 'F' | 'U'} Gender */

/** @typedef {'exact' | 'about' | 'estimated' | 'calculated' | 'before' | 'after' | 'between'} DateQualifier */

/**
 * Дата с точностью. Любая часть может быть неизвестна.
 * @typedef {object} GDate
 * @property {DateQualifier} qualifier
 * @property {number | null} [day]
 * @property {number | null} [month]
 * @property {number | null} [year]
 * @property {number | null} [day2] Вторая граница для «между»
 * @property {number | null} [month2]
 * @property {number | null} [year2]
 * @property {'julian'} [calendar] Дата по старому стилю (юлианский календарь)
 * @property {string} [text] Исходный текст, если дату не удалось разобрать («весна 1942»)
 */

/**
 * Ссылка на источник.
 * @typedef {object} Citation
 * @property {string} id
 * @property {string} sourceId
 * @property {string} page Лист, страница, запись
 * @property {0 | 1 | 2 | 3} quality 3 — прямое свидетельство … 0 — ненадёжное
 * @property {string} note
 */

/**
 * @typedef {object} EventPoint
 * @property {GDate} date
 * @property {string | null} placeId
 * @property {Citation[]} [citations]
 */

/**
 * Событие жизни (крещение, учёба, служба, переезд…).
 * @typedef {object} LifeEvent
 * @property {string} id
 * @property {string} type Ключ из EVENT_TYPES
 * @property {string} title Название для типа custom
 * @property {GDate} date
 * @property {string | null} placeId
 * @property {string} description
 * @property {Citation[]} citations
 */

/** @typedef {'public' | 'family' | 'private'} Privacy */

/**
 * @typedef {object} Person
 * @property {string} id
 * @property {Gender} gender
 * @property {string} firstName
 * @property {string} middleName Отчество
 * @property {string} lastName
 * @property {string} birthName Фамилия при рождении (девичья)
 * @property {string} nickname
 * @property {string} title Звание, титул
 * @property {string} suffix Старший, II…
 * @property {string | null} clanId Род
 * @property {boolean} living
 * @property {EventPoint} birth
 * @property {EventPoint & { cause: string }} death
 * @property {string | null} residencePlaceId Место жительства
 * @property {string} occupation Основное занятие
 * @property {string} email
 * @property {string} phone
 * @property {string | null} avatarId Главное фото (id из media)
 * @property {string} note Короткий комментарий
 * @property {string} biography
 * @property {LifeEvent[]} events
 * @property {Record<string, string>} custom Значения дополнительных полей (ключ — id из customFields)
 * @property {Citation[]} citations
 * @property {boolean} favorite
 * @property {Privacy} privacy
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/** @typedef {'married' | 'partners' | 'engaged' | 'divorced' | 'separated' | 'widowed' | 'unknown'} FamilyStatus */

/** @typedef {'birth' | 'adopted' | 'foster' | 'step' | 'guardian' | 'unknown'} ChildLink */

/**
 * Семья — союз партнёров и их дети. Ребёнок может состоять в нескольких семьях-родителях
 * (кровные и приёмные родители); основная — с типом связи «кровный».
 * @typedef {object} Family
 * @property {string} id
 * @property {string[]} partners 0–2 партнёра. Порядок не важен: при отрисовке мужчина слева.
 * @property {FamilyStatus} status
 * @property {EventPoint} marriage
 * @property {EventPoint} divorce
 * @property {string[]} children
 * @property {Record<string, ChildLink>} childLinks Тип связи ребёнка с этой семьёй (по умолчанию birth)
 * @property {string} note
 * @property {Citation[]} citations
 */

/** @typedef {'country' | 'region' | 'district' | 'city' | 'village' | 'address' | 'cemetery' | 'church' | 'other'} PlaceType */

/**
 * @typedef {object} Place
 * @property {string} id
 * @property {string} name
 * @property {PlaceType} type
 * @property {string | null} parentId Иерархия: страна → регион → город…
 * @property {number | null} lat
 * @property {number | null} lng
 * @property {string} altNames Другие названия (через запятую), в том числе исторические
 * @property {string} note
 */

/** @typedef {'photo' | 'document' | 'audio' | 'video' | 'other'} MediaKind */

/**
 * Фото, скан документа, запись. Одно медиа может относиться к нескольким людям.
 * @typedef {object} Media
 * @property {string} id
 * @property {MediaKind} kind
 * @property {string} title
 * @property {string} description
 * @property {GDate} date
 * @property {string | null} placeId
 * @property {string[]} personIds
 * @property {string | null} sourceId
 * @property {string | null} src URL файла (статический, удалённый или data:)
 * @property {string | null} fileKey Ключ файла в локальном хранилище (IndexedDB)
 * @property {string | null} thumb Миниатюра (data: или URL)
 * @property {string} mime
 * @property {number} size
 * @property {number} createdAt
 */

/** @typedef {'archive' | 'metric' | 'census' | 'revision' | 'book' | 'website' | 'document' | 'oral' | 'other'} SourceType */

/**
 * @typedef {object} Source
 * @property {string} id
 * @property {string} title
 * @property {SourceType} type
 * @property {string} author
 * @property {string} repository Архив, библиотека
 * @property {string} callNumber Шифр: фонд, опись, дело
 * @property {string} url
 * @property {GDate} date
 * @property {string} note
 */

/**
 * Род (ветвь фамилии) — для группировки и раскраски древа.
 * @typedef {object} Clan
 * @property {string} id
 * @property {string} name
 * @property {string} color
 * @property {string} description
 */

/**
 * @typedef {object} CustomFieldDef
 * @property {string} id
 * @property {string} label
 * @property {'text' | 'number' | 'date' | 'url'} type
 */

/**
 * @typedef {object} TreeData
 * @property {2} version
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string | null} homePersonId «Это Вы» — от этой персоны считается родство
 * @property {Record<string, Person>} persons
 * @property {Record<string, Family>} families
 * @property {Record<string, Place>} places
 * @property {Record<string, Media>} media
 * @property {Record<string, Source>} sources
 * @property {Record<string, Clan>} clans
 * @property {CustomFieldDef[]} customFields
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * Краткие сведения о древе для списка на главной.
 * @typedef {object} TreeSummary
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {number} persons
 * @property {number} families
 * @property {number} media
 * @property {string | null} homeName
 * @property {string | null} homeThumb
 * @property {'owner' | 'editor' | 'viewer'} role
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * @typedef {object} User
 * @property {string} id
 * @property {string} email
 * @property {string} name
 * @property {string | null} avatar
 * @property {boolean} emailVerified
 * @property {boolean} guest
 * @property {number} createdAt
 */

/** @typedef {'father' | 'mother' | 'brother' | 'sister' | 'partner' | 'son' | 'daughter'} RelativeKind */

/** @typedef {'family' | 'direct' | 'blood' | 'all' | 'ancestors' | 'descendants'} ChartScope */

/** @typedef {'tree' | 'pedigree' | 'fan' | 'timeline'} ChartView */

export {}
