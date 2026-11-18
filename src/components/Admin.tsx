import { useEffect, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { ArrowDown, ArrowUp, Eye, EyeOff, Link as LinkIcon, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import { db } from '../firebase'
import { deleteFile, saveFile } from '../mediaStore'
import { useCatalog } from '../useCatalog'
import { money, seedServices } from '../data'
import type { Media, Service } from '../types'
import { MediaItem } from './MediaView'

const inp = 'w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm outline-none focus:border-yellow-500'
const btn = 'rounded-lg border border-yellow-600/50 px-3 py-1.5 text-sm text-yellow-400 hover:bg-yellow-500/10'

function Login({ onOk }: { onOk: () => void }) {
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const expected = import.meta.env.VITE_ADMIN_PASSWORD
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] p-4 text-white">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (expected && pass === expected) {
            sessionStorage.setItem('admin-ok', pass)
            onOk()
          } else setErr(expected ? 'Contraseña incorrecta' : 'Falta configurar VITE_ADMIN_PASSWORD')
        }}
        className="w-full max-w-sm space-y-3 rounded-2xl border border-yellow-600/30 bg-white/5 p-6"
      >
        <h1 className="text-center font-serif text-2xl text-yellow-400">Panel de administración</h1>
        <input className={inp} type="password" placeholder="Contraseña" value={pass} onChange={(e) => setPass(e.target.value)} />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button className="w-full rounded-full bg-yellow-500 py-2 font-medium text-black">Ingresar</button>
      </form>
    </div>
  )
}

function Editor({ service, categories, onClose, nextOrder }: { service: Service | null; categories: string[]; onClose: () => void; nextOrder: number }) {
  const [f, setF] = useState({
    title: service?.title ?? '',
    category: service?.category ?? categories[0] ?? '',
    description: service?.description ?? '',
    price: service?.price ?? 0,
    options: (service?.options ?? []).map((o) => `${o.label}:${o.price}`).join('\n'),
  })
  const [media, setMedia] = useState<Media[]>(service?.media ?? [])
  const [url, setUrl] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState('')

  const upload = async (files: FileList | null) => {
    if (!files) return
    setError('')
    for (const file of Array.from(files)) {
      try {
        setProgress(0)
        const m = await saveFile(file, setProgress)
        setMedia((cur) => [...cur, m])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo guardar el archivo')
      }
    }
    setProgress(null)
  }

  const addUrl = () => {
    if (!url.trim()) return
    const isVideo = /youtu\.?be|\.(mp4|webm|mov)(\?|$)/i.test(url)
    setMedia([...media, { url: url.trim(), type: isVideo ? 'video' : 'image' }])
    setUrl('')
  }

  const removeMedia = async (i: number) => {
    const m = media[i]
    setMedia(media.filter((_, k) => k !== i))
    deleteFile(m).catch(() => {})
  }

  const save = async () => {
    const options = f.options
      .split('\n')
      .map((l) => l.split(':'))
      .filter((p) => p[0].trim() && p[1] && !isNaN(Number(p[1])))
      .map(([label, price]) => ({ label: label.trim(), price: Number(price) }))
    const data = { title: f.title, category: f.category, description: f.description, price: Number(f.price), options, media }
    if (service && !service.id.startsWith('seed-')) await updateDoc(doc(db, 'services', service.id), data)
    else await addDoc(collection(db, 'services'), { ...data, visible: true, order: nextOrder })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4">
      <div className="w-full max-w-xl space-y-3 rounded-2xl border border-yellow-600/30 bg-[#0A0A0A] p-5">
        <div className="flex justify-between">
          <h2 className="font-serif text-xl text-yellow-400">{service ? 'Editar servicio' : 'Nuevo servicio'}</h2>
          <button onClick={onClose}><X /></button>
        </div>
        <input className={inp} placeholder="Título" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <input className={inp} list="cats" placeholder="Categoría" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
        <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        <textarea className={inp} rows={3} placeholder="Descripción / detalle" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <input className={inp} type="number" placeholder="Precio" value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} />
        <textarea className={inp} rows={2} placeholder={'Opciones (una por línea, formato nombre:precio)\nPor ojo:1500\nAmbos ojos:3000'} value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} />

        <div className="rounded-xl border border-yellow-600/20 p-3">
          <p className="mb-2 text-sm text-yellow-400">Fotos y videos de demostración</p>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {media.map((m, i) => (
              <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-700">
                <MediaItem m={m} className="h-full w-full object-cover" />
                {m.type === 'video' && <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 text-[10px] text-yellow-400">VIDEO</span>}
                <button onClick={() => removeMedia(i)} className="absolute right-1 top-1 rounded-full bg-black/80 p-1 text-red-400"><Trash2 size={14} /></button>
              </div>
            ))}
            {media.length === 0 && <p className="col-span-3 text-xs text-gray-500">Todavía no hay archivos.</p>}
          </div>
          <label className={`${btn} flex cursor-pointer items-center justify-center gap-2`}>
            <Upload size={16} /> Subir imágenes o videos (video hasta 8 MB)
            <input type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
          </label>
          {progress !== null && (
            <div className="mt-2 h-1.5 overflow-hidden rounded bg-gray-800"><div className="h-full bg-yellow-500" style={{ width: progress + '%' }} /></div>
          )}
          <div className="mt-2 flex gap-2">
            <input className={inp} placeholder="O pegá un link (imagen, mp4 o YouTube)" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button onClick={addUrl} className={btn}><LinkIcon size={16} /></button>
          </div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={btn}>Cancelar</button>
          <button disabled={!f.title || progress !== null} onClick={save} className="rounded-lg bg-yellow-500 px-4 py-1.5 text-sm font-medium text-black disabled:opacity-40">Guardar</button>
        </div>
      </div>
    </div>
  )
}

function Dashboard({ onExit }: { onExit: () => void }) {
  const { services, settings, fromDb } = useCatalog()
  const [edit, setEdit] = useState<Service | 'new' | null>(null)
  const [wa, setWa] = useState(settings.whatsapp)
  const [banner, setBanner] = useState(settings.banner)
  useEffect(() => { setWa(settings.whatsapp); setBanner(settings.banner) }, [settings])
  const categories = [...new Set(services.map((s) => s.category))]

  const seed = async () => {
    const b = writeBatch(db)
    seedServices.forEach((s) => b.set(doc(collection(db, 'services')), s))
    await b.commit()
  }
  const move = async (i: number, d: number) => {
    const a = services[i], c = services[i + d]
    if (!c) return
    const b = writeBatch(db)
    b.update(doc(db, 'services', a.id), { order: c.order })
    b.update(doc(db, 'services', c.id), { order: a.order })
    await b.commit()
  }

  return (
    <div className="min-h-screen bg-[#050505] p-4 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-serif text-2xl text-yellow-400">Admin · Ruth Estética</h1>
          <div className="flex gap-2">
            <a href="/" className={btn}>Ver sitio</a>
            <button onClick={() => { sessionStorage.removeItem('admin-ok'); onExit() }} className={btn}>Salir</button>
          </div>
        </div>

        <div className="mb-6 space-y-2 rounded-2xl border border-yellow-600/30 bg-white/5 p-4">
          <p className="text-sm text-yellow-400">Datos generales</p>
          <input className={inp} placeholder="WhatsApp (ej. 5493510000000)" value={wa} onChange={(e) => setWa(e.target.value)} />
          <input className={inp} placeholder="Banner de aviso / promoción" value={banner} onChange={(e) => setBanner(e.target.value)} />
          <button className={btn} onClick={() => setDoc(doc(db, 'settings', 'general'), { whatsapp: wa.replace(/\D/g, ''), banner })}>Guardar</button>
        </div>

        {!fromDb && (
          <div className="mb-4 rounded-xl border border-yellow-600/40 p-4 text-sm">
            Todavía no hay servicios en la base de datos. <button onClick={seed} className="ml-2 rounded bg-yellow-500 px-3 py-1 text-black">Cargar servicios iniciales</button>
          </div>
        )}

        <div className="mb-3 flex items-center justify-between">
          <p className="text-gray-400">{services.length} servicios</p>
          <button onClick={() => setEdit('new')} className="flex items-center gap-1 rounded-lg bg-yellow-500 px-3 py-1.5 text-sm font-medium text-black"><Plus size={16} /> Nuevo</button>
        </div>
        <div className="space-y-2">
          {services.map((s, i) => (
            <div key={s.id} className={`flex items-center gap-3 rounded-xl border border-yellow-600/20 bg-white/5 p-3 ${s.visible === false ? 'opacity-50' : ''}`}>
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black">{s.media?.[0] && <MediaItem m={s.media[0]} className="h-full w-full object-cover" />}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{s.title}</p>
                <p className="text-xs text-gray-500">{s.category} · {money(s.price)} · {s.media?.length ?? 0} archivos</p>
              </div>
              {fromDb && (
                <>
                  <button onClick={() => move(i, -1)}><ArrowUp size={16} /></button>
                  <button onClick={() => move(i, 1)}><ArrowDown size={16} /></button>
                  <button onClick={() => updateDoc(doc(db, 'services', s.id), { visible: s.visible === false })}>{s.visible === false ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  <button onClick={() => setEdit(s)}><Pencil size={16} className="text-yellow-400" /></button>
                  <button onClick={() => confirm('¿Eliminar servicio?') && deleteDoc(doc(db, 'services', s.id))}><Trash2 size={16} className="text-red-400" /></button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      {edit && <Editor service={edit === 'new' ? null : edit} categories={categories} nextOrder={services.length ? Math.max(...services.map((s) => s.order)) + 1 : 0} onClose={() => setEdit(null)} />}
    </div>
  )
}

export default function Admin() {
  const expected = import.meta.env.VITE_ADMIN_PASSWORD
  const [ok, setOk] = useState(!!expected && sessionStorage.getItem('admin-ok') === expected)
  return ok ? <Dashboard onExit={() => setOk(false)} /> : <Login onOk={() => setOk(true)} />
}
