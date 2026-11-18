import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { authReady, db, formatFirebaseError, withTimeout } from './firebase'
import type { Media } from './types'

const CHUNK = 650_000 // caracteres base64 por documento (< 1 MB limite Firestore)
export const MAX_VIDEO_MB = 8

function toDataUrl(file: Blob) {
  return new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(new Error('No se pudo leer el archivo seleccionado'))
    r.readAsDataURL(file)
  })
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('No se pudo procesar la imagen. Probá con formato JPG, PNG o WebP.'))
    }
    img.src = objectUrl
  })
}

async function compressImage(file: File, maxPx = 1280): Promise<{ dataUrl: string; blobUrl: string }> {
  const img = await loadImageElement(file)
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  const scale = Math.min(1, maxPx / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * scale))
  c.height = Math.max(1, Math.round(h * scale))
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('No se pudo comprimir la imagen en este navegador')
  ctx.drawImage(img, 0, 0, c.width, c.height)
  const dataUrl = c.toDataURL('image/jpeg', 0.82)
  const blob: Blob = await new Promise((res) =>
    c.toBlob((b) => res(b ?? new Blob()), 'image/jpeg', 0.82),
  )
  return { dataUrl, blobUrl: URL.createObjectURL(blob) }
}

const cache = new Map<string, Promise<string>>()

// Guarda un archivo solo en Firestore usando documentos con ID deterministico files/{fileId}_{i}
// para evitar queries por indice y pre-cachea la vista previa local al instante.
export async function saveFile(
  file: File,
  onProgress?: (p: number) => void,
  options?: { maxPx?: number },
): Promise<Media> {
  const isImage = file.type.startsWith('image') || /\.(jpe?g|png|webp|gif|avif)$/i.test(file.name)
  const isVideo = file.type.startsWith('video') || /\.(mp4|webm|mov|m4v)$/i.test(file.name)
  if (!isImage && !isVideo) {
    throw new Error('Formato no soportado (' + file.name + '). Usá JPG, PNG, WebP o MP4.')
  }
  if (isVideo && file.size > MAX_VIDEO_MB * 1024 * 1024) {
    throw new Error(`El video pesa más de ${MAX_VIDEO_MB} MB. Subilo a YouTube o achicalo y pegá el link.`)
  }

  await authReady
  onProgress?.(5)

  let dataUrl: string
  let localPreviewUrl: string
  if (isImage) {
    const compressed = await compressImage(file, options?.maxPx ?? 1280)
    dataUrl = compressed.dataUrl
    localPreviewUrl = compressed.blobUrl
  } else {
    dataUrl = await toDataUrl(file)
    localPreviewUrl = URL.createObjectURL(file)
  }

  const data = dataUrl.split(',')[1] ?? ''
  if (!data) throw new Error('El archivo está vacío o no pudo convertirse')

  const fileId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  const chunks = Math.max(1, Math.ceil(data.length / CHUNK))

  try {
    for (let i = 0; i < chunks; i++) {
      await withTimeout(
        setDoc(doc(db, 'files', `${fileId}_${i}`), {
          fileId,
          index: i,
          data: data.slice(i * CHUNK, (i + 1) * CHUNK),
        }),
        20000,
      )
      onProgress?.(Math.round(((i + 1) / chunks) * 100))
    }
  } catch (e) {
    URL.revokeObjectURL(localPreviewUrl)
    throw new Error(formatFirebaseError(e))
  }

  // Vista previa inmediata en memoria sin volver a descargar desde Firestore
  cache.set(fileId, Promise.resolve(localPreviewUrl))

  return {
    type: isImage ? 'image' : 'video',
    url: '',
    fileId,
    mime: isImage ? 'image/jpeg' : file.type || 'video/mp4',
    chunks,
  }
}

export async function deleteFile(m?: Media | null) {
  if (!m?.fileId) return
  await authReady
  cache.delete(m.fileId)
  if (m.chunks && m.chunks > 0) {
    await Promise.all(
      Array.from({ length: m.chunks }, (_, i) =>
        deleteDoc(doc(db, 'files', `${m.fileId}_${i}`)).catch(() => {}),
      ),
    )
    return
  }
  const snap = await getDocs(query(collection(db, 'files'), where('fileId', '==', m.fileId)))
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref).catch(() => {})))
}

function base64ToBlobUrl(b64: string, mime?: string) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return URL.createObjectURL(new Blob([bytes], { type: mime || 'image/jpeg' }))
}

function load(m: Media): Promise<string> {
  const id = m.fileId!
  if (!cache.has(id)) {
    const task = (async () => {
      await authReady
      if (m.chunks && m.chunks > 0) {
        const docs = await Promise.all(
          Array.from({ length: m.chunks }, (_, i) => getDoc(doc(db, 'files', `${id}_${i}`))),
        )
        if (docs.every((d) => d.exists())) {
          const joined = docs.map((d) => (d.data() as { data: string }).data).join('')
          return base64ToBlobUrl(joined, m.mime)
        }
      }
      // Compatibilidad con archivos guardados sin contador de trozos
      const snap = await getDocs(query(collection(db, 'files'), where('fileId', '==', id)))
      if (snap.empty) throw new Error('Archivo no encontrado')
      const parts = snap.docs
        .map((d) => d.data() as { index: number; data: string })
        .sort((a, b) => a.index - b.index)
      return base64ToBlobUrl(parts.map((p) => p.data).join(''), m.mime)
    })().catch((err) => {
      cache.delete(id)
      throw err
    })
    cache.set(id, task)
  }
  return cache.get(id)!
}

export function useMediaSrc(m?: Media | null) {
  const [src, setSrc] = useState<string | null>(() => {
    if (!m) return null
    return m.fileId ? null : m.url || null
  })
  useEffect(() => {
    if (!m) {
      setSrc(null)
      return
    }
    if (!m.fileId) {
      setSrc(m.url || null)
      return
    }
    let active = true
    load(m)
      .then((u) => {
        if (active) setSrc(u)
      })
      .catch(() => {
        if (active) setSrc(null)
      })
    return () => {
      active = false
    }
  }, [m?.fileId, m?.url, m?.chunks])
  return src
}
