/**
 * Локальная база в IndexedDB. Если IndexedDB недоступна (приватный режим старых браузеров),
 * данные живут в памяти до закрытия вкладки.
 *
 * Хранилища:
 *  users     — локальные учётные записи (демо-режим без сервера)
 *  sessions  — токены входа
 *  trees     — древа целиком (TreeData + ownerId)
 *  summaries — краткие сведения о древах для главной
 *  files     — файлы медиа (Blob)
 *  kv        — прочее
 */
import { openDB } from 'idb'

const DB_NAME = 'rodoslovnaya'
const DB_VERSION = 1
const STORES = ['users', 'sessions', 'trees', 'summaries', 'files', 'kv']

let dbPromise = null
let memory = null

function openDatabase() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('users')) db.createObjectStore('users', { keyPath: 'id' }).createIndex('email', 'email', { unique: true })
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions')
      if (!db.objectStoreNames.contains('trees')) db.createObjectStore('trees', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('summaries')) db.createObjectStore('summaries', { keyPath: 'id' }).createIndex('ownerId', 'ownerId')
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files')
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
    },
    blocked() {
      console.warn('[db] обновление базы ждёт закрытия других вкладок')
    },
  })
}

async function getDb() {
  if (memory) return null
  if (!dbPromise) {
    dbPromise = (typeof indexedDB === 'undefined' ? Promise.reject(new Error('no indexedDB')) : openDatabase()).catch((e) => {
      console.warn('[db] IndexedDB недоступна, данные хранятся в памяти', e)
      memory = Object.fromEntries(STORES.map((s) => [s, new Map()]))
      return null
    })
  }
  return dbPromise
}

const KEY_PATH = { users: 'id', trees: 'id', summaries: 'id' }

export const store = {
  async get(name, key) {
    const db = await getDb()
    if (!db) return structuredCloneSafe(memory[name].get(key))
    return db.get(name, key)
  },
  async put(name, value, key) {
    const db = await getDb()
    if (!db) {
      memory[name].set(key ?? value[KEY_PATH[name]], structuredCloneSafe(value))
      return
    }
    await (KEY_PATH[name] ? db.put(name, value) : db.put(name, value, key))
  },
  async delete(name, key) {
    const db = await getDb()
    if (!db) return void memory[name].delete(key)
    await db.delete(name, key)
  },
  async all(name) {
    const db = await getDb()
    if (!db) return [...memory[name].values()].map(structuredCloneSafe)
    return db.getAll(name)
  },
  async byIndex(name, index, value) {
    const db = await getDb()
    if (!db) return [...memory[name].values()].filter((v) => v[index] === value).map(structuredCloneSafe)
    return db.getAllFromIndex(name, index, value)
  },
  async oneByIndex(name, index, value) {
    const db = await getDb()
    if (!db) return structuredCloneSafe([...memory[name].values()].find((v) => v[index] === value))
    return db.getFromIndex(name, index, value)
  },
  /** Оценка занятого места (байты) и квоты. */
  async estimate() {
    if (navigator.storage?.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate()
      return { usage, quota }
    }
    return { usage: 0, quota: 0 }
  },
  async persist() {
    try {
      return (await navigator.storage?.persist?.()) ?? false
    } catch {
      return false
    }
  },
  get inMemory() {
    return !!memory
  },
}

function structuredCloneSafe(v) {
  if (v === undefined || v === null) return v
  try {
    return structuredClone(v)
  } catch {
    return v
  }
}
