import { useCallback, useEffect, useState } from 'react'
import { collection, doc, getDoc, getDocs, getDocsFromServer, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'
import { defaultSettings, seedServices } from './data'
import type { Service, Settings } from './types'

const sortServices = (l: Service[]) => [...l].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
const seeded = seedServices.map((s, i) => ({ ...s, id: 'seed-' + i }))

export function useCatalog() {
  const [services, setServices] = useState<Service[]>(seeded)
  const [fromDb, setFromDb] = useState(false)
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  const apply = (docs: { id: string; data: () => unknown }[], keepError = false) => {
    if (!docs.length) {
      setServices(seeded)
      setFromDb(false)
    } else {
      setServices(sortServices(docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Service, 'id'>) }))))
      setFromDb(true)
    }
    setLastSync(new Date())
    if (!keepError) setError('')
  }

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'services'), (snap) => apply(snap.docs), (e) => setError(e.code === 'permission-denied' ? 'Firestore rechazó la lectura (permission-denied). Revisá las reglas.' : 'Sin conexión con Firebase: ' + e.message))
    const u2 = onSnapshot(
      doc(db, 'settings', 'general'),
      (d) => d.exists() && setSettings({ ...defaultSettings, ...(d.data() as Settings) }),
      (e) => setError(e.message),
    )
    return () => {
      u1()
      u2()
    }
  }, [])

  // Fuerza una lectura directa del servidor (ignora la cache local)
  const sync = useCallback(async () => {
    setSyncing(true)
    try {
      let docs
      try {
        docs = (await getDocsFromServer(collection(db, 'services'))).docs
      } catch (e) {
        const code = (e as { code?: string }).code
        if (code === 'permission-denied') throw new Error('Firestore rechazó la lectura (permission-denied). Habilitá "allow read, write: if true;" en las reglas de Firestore.')
        // Sin conexion directa: usar lo ultimo disponible (cache / listener en vivo)
        docs = (await getDocs(collection(db, 'services'))).docs
        setError('No hay conexión directa con Firebase; se muestran los últimos datos guardados en este navegador.')
        apply(docs, true)
        setSyncing(false)
        return
      }
      apply(docs)
      const g = await getDoc(doc(db, 'settings', 'general'))
      if (g.exists()) setSettings({ ...defaultSettings, ...(g.data() as Settings) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo sincronizar')
    }
    setSyncing(false)
  }, [])

  return { services, settings, fromDb, error, syncing, lastSync, sync }
}

// Categorias: primero el orden guardado en settings, luego las que aparezcan en servicios
export function orderedCategories(services: Service[], settings: Settings) {
  const used = services.map((s) => s.category).filter(Boolean)
  return [...new Set([...(settings.categories ?? []), ...used])]
}
