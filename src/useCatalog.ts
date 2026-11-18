import { useCallback, useEffect, useState } from 'react'
import { collection, doc, getDoc, getDocs, getDocsFromServer, onSnapshot } from 'firebase/firestore'
import { authReady, db, formatFirebaseError } from './firebase'
import { defaultSettings, seedServices } from './data'
import type { Service, Settings } from './types'

const sortServices = (l: Service[]) => [...l].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
const seeded = seedServices.map((s, i) => ({ ...s, id: 'seed-' + i }))

export function useCatalog() {
  const [services, setServices] = useState<Service[]>(seeded)
  const [fromDb, setFromDb] = useState(false)
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [error, setError] = useState('')
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  const handleErr = (e: unknown) => {
    const code = (e as { code?: string })?.code ?? ''
    const raw = e instanceof Error ? e.message : String(e)
    const denied = code === 'permission-denied' || /Missing or insufficient permissions/i.test(raw)
    setPermissionDenied(denied)
    setError(formatFirebaseError(e))
  }

  const apply = (docs: { id: string; data: () => unknown }[], keepError = false) => {
    if (!docs.length) {
      setServices(seeded)
      setFromDb(false)
    } else {
      setServices(sortServices(docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Service, 'id'>) }))))
      setFromDb(true)
    }
    setLastSync(new Date())
    if (!keepError) {
      setError('')
      setPermissionDenied(false)
    }
  }

  useEffect(() => {
    let u1: (() => void) | undefined
    let u2: (() => void) | undefined
    let cancelled = false

    authReady.then(() => {
      if (cancelled) return
      u1 = onSnapshot(collection(db, 'services'), (snap) => apply(snap.docs), handleErr)
      u2 = onSnapshot(
        doc(db, 'settings', 'general'),
        (d) => {
          if (d.exists()) setSettings({ ...defaultSettings, ...(d.data() as Settings) })
        },
        handleErr,
      )
    })

    return () => {
      cancelled = true
      u1?.()
      u2?.()
    }
  }, [])

  // Sincroniza desde el servidor con fallback seguro a cache local sin romper la UI
  const sync = useCallback(async () => {
    setSyncing(true)
    await authReady
    try {
      let docs
      let usedCache = false
      try {
        docs = (await getDocsFromServer(collection(db, 'services'))).docs
      } catch (e) {
        const code = (e as { code?: string })?.code ?? ''
        if (code === 'permission-denied') throw e
        docs = (await getDocs(collection(db, 'services'))).docs
        usedCache = true
      }

      try {
        const g = await getDoc(doc(db, 'settings', 'general'))
        if (g.exists()) setSettings({ ...defaultSettings, ...(g.data() as Settings) })
      } catch (e) {
        const code = (e as { code?: string })?.code ?? ''
        if (code === 'permission-denied') throw e
      }

      if (usedCache) {
        setError('Sin conexión directa con el servidor; mostrando datos guardados en este navegador.')
        apply(docs, true)
      } else {
        apply(docs)
      }
    } catch (e) {
      handleErr(e)
    }
    setSyncing(false)
  }, [])

  return { services, settings, fromDb, error, permissionDenied, syncing, lastSync, sync }
}

// Categorias: primero el orden guardado en settings, luego las que aparezcan en servicios
export function orderedCategories(services: Service[], settings: Settings) {
  const used = services.map((s) => s.category).filter(Boolean)
  return [...new Set([...(settings.categories ?? []), ...used])]
}
