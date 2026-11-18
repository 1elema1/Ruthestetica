import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'
import { defaultSettings, seedServices } from './data'
import type { Service, Settings } from './types'

export function useCatalog() {
  const [services, setServices] = useState<Service[]>(() =>
    seedServices.map((s, i) => ({ ...s, id: 'seed-' + i })),
  )
  const [fromDb, setFromDb] = useState(false)
  const [settings, setSettings] = useState<Settings>(defaultSettings)

  useEffect(() => {
    const u1 = onSnapshot(
      collection(db, 'services'),
      (snap) => {
        if (snap.empty) return
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Service, 'id'>) }))
        setServices(list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
        setFromDb(true)
      },
      () => {},
    )
    const u2 = onSnapshot(
      doc(db, 'settings', 'general'),
      (d) => d.exists() && setSettings({ ...defaultSettings, ...(d.data() as Settings) }),
      () => {},
    )
    return () => {
      u1()
      u2()
    }
  }, [])

  return { services, settings, fromDb }
}
