import { useEffect, useState } from 'react'
import { addDoc, collection, deleteDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'
import type { Media } from './types'

const CHUNK = 700_000 // caracteres base64 por documento (limite Firestore: 1 MB)
export const MAX_VIDEO_MB = 8

function toDataUrl(file: Blob) {
  return new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

async function compressImage(file: File): Promise<string> {
  const img = await createImageBitmap(file)
  const scale = Math.min(1, 1280 / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale)
  c.height = Math.round(img.height * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  let q = 0.8
  let out = c.toDataURL('image/jpeg', q)
  while (out.length > 700_000 && q > 0.3) out = c.toDataURL('image/jpeg', (q -= 0.1))
  return out
}

// Guarda un archivo solo en Firestore. Imagenes: comprimidas dentro del propio servicio.
// Videos: partidos en trozos en la coleccion "files".
export async function saveFile(file: File, onProgress?: (p: number) => void): Promise<Media> {
  if (file.type.startsWith('image')) return { type: 'image', url: await compressImage(file) }
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) throw new Error(`El video supera ${MAX_VIDEO_MB} MB. Subilo a YouTube y pegá el link.`)
  const data = (await toDataUrl(file)).split(',')[1]
  const fileId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const n = Math.ceil(data.length / CHUNK)
  for (let i = 0; i < n; i++) {
    await addDoc(collection(db, 'files'), { fileId, index: i, data: data.slice(i * CHUNK, (i + 1) * CHUNK) })
    onProgress?.(Math.round(((i + 1) / n) * 100))
  }
  return { type: 'video', url: '', fileId, mime: file.type || 'video/mp4' }
}

export async function deleteFile(m: Media) {
  if (!m.fileId) return
  const snap = await getDocs(query(collection(db, 'files'), where('fileId', '==', m.fileId)))
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
}

const cache = new Map<string, Promise<string>>()
function load(m: Media) {
  if (!cache.has(m.fileId!)) {
    cache.set(
      m.fileId!,
      getDocs(query(collection(db, 'files'), where('fileId', '==', m.fileId))).then((snap) => {
        const parts = snap.docs.map((d) => d.data() as { index: number; data: string }).sort((a, b) => a.index - b.index)
        const bin = atob(parts.map((p) => p.data).join(''))
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        return URL.createObjectURL(new Blob([bytes], { type: m.mime }))
      }),
    )
  }
  return cache.get(m.fileId!)!
}

export function useMediaSrc(m: Media) {
  const [src, setSrc] = useState<string | null>(m.fileId ? null : m.url)
  useEffect(() => {
    if (!m.fileId) return setSrc(m.url)
    let on = true
    load(m).then((u) => on && setSrc(u)).catch(() => {})
    return () => { on = false }
  }, [m.fileId, m.url])
  return src
}
