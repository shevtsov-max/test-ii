export type Gender = 'M' | 'F' | 'U'

export type DateQualifier = 'exact' | 'about' | 'before' | 'after' | 'between' | 'estimated'

export interface GDate {
  qualifier: DateQualifier
  day?: number | null
  month?: number | null
  year?: number | null
  /** Вторая граница для «между» */
  day2?: number | null
  month2?: number | null
  year2?: number | null
}

export interface LifeEvent {
  date: GDate
  place: string
}

export type FactType =
  | 'baptism'
  | 'education'
  | 'occupation'
  | 'residence'
  | 'military'
  | 'emigration'
  | 'immigration'
  | 'burial'
  | 'religion'
  | 'nationality'
  | 'award'
  | 'custom'

export interface Fact {
  id: string
  type: FactType
  title?: string
  date: GDate
  place: string
  description: string
}

export interface Photo {
  id: string
  src: string
  caption: string
  addedAt: number
}

export interface Person {
  id: string
  gender: Gender
  firstName: string
  middleName: string
  lastName: string
  birthName: string
  nickname: string
  title: string
  suffix: string
  living: boolean
  birth: LifeEvent
  death: LifeEvent & { cause: string }
  email: string
  phone: string
  /** Главное фото (id из photos) */
  avatarId: string | null
  photos: Photo[]
  biography: string
  facts: Fact[]
  createdAt: number
  updatedAt: number
}

export type FamilyStatus = 'married' | 'partners' | 'engaged' | 'divorced' | 'separated' | 'widowed' | 'unknown'

export interface Family {
  id: string
  /** Партнёры (0–2). Порядок не важен, для отрисовки мужчина слева. */
  partners: string[]
  status: FamilyStatus
  marriage: LifeEvent
  divorce: LifeEvent
  children: string[]
}

export interface TreeData {
  version: 1
  id: string
  name: string
  homePersonId: string | null
  persons: Record<string, Person>
  families: Record<string, Family>
}

export type RelativeKind = 'father' | 'mother' | 'brother' | 'sister' | 'partner' | 'son' | 'daughter'

export type ViewMode = 'family' | 'pedigree' | 'fan' | 'list'
