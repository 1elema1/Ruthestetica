import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import {
  AlertTriangle, ArrowDown, ArrowUp, Check, Eye, EyeOff, FolderPlus, Link as LinkIcon, Loader2, LogOut,
  Pencil, Plus, RefreshCw, Search, Trash2, Upload, X, ExternalLink, Copy,
} from 'lucide-react'
import { db } from '../firebase'
import { deleteFile, saveFile } from '../mediaStore'
import { orderedCategories, useCatalog } from '../useCatalog'
import { money, seedServices } from '../data'
import type { Media, Service } from '../types'
import { MediaItem } from './MediaView'

const inp = 'w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm outline-none transition focus:border-yellow-500'
const btn = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-yellow-600/40 px-3 py-1.5 text-sm text-yellow-400 transition hover:bg-yellow-500/10 disabled:opacity-40'
const btnGold = 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#E5C158] px-4 py-1.5 text-sm font-medium text-black transition hover:brightness-110 disabled:opacity-40'
const card = 'rounded-2xl border border-yellow-600/20 bg-white/[0.03] p-4'

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Ocurrió un error')

function Login({ onOk }: { onOk: () => void }) {
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const expected = import.meta.env.VITE_ADMIN_PASSWORD
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,#1c1608,#050505_70%)] p-4 text-white">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (expected && pass === expected) {
            sessionStorage.setItem('admin-ok', pass)
            onOk()
          } else setErr(expected ? 'Contraseña incorrecta' : 'Falta configurar VITE_ADMIN_PASSWORD')
        }}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-yellow-600/30 bg-white/5 p-8 backdrop-blur-md"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-yellow-500 font-serif text-xl text-yellow-400">RB</div>
        <h1 className="text-center font-serif text-2xl text-yellow-400">Panel de administración</h1>
        <input className={inp} type="password" placeholder="Contraseña" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button className={`${btnGold} w-full py-2.5`}>Ingresar</button>
      </form>
    </div>
  )
}

function Editor({ service, categories, onClose, nextOrder }: { service: Service | null; categories: string[]; onClose: () => void; nextOrder: number }) {
  const [f, setF] = useState({
    title: service?.title ?? '',
    category: service?.category ?? categories[0] ?? '',
    description: service?.description ?? '',
    price: String(service?.price ?? ''),
    options: (service?.options ?? []).map((o) => `${o.label}:${o.price}`).join('\n'),
  })
  const [media, setMedia] = useState<Media[]>(service?.media ?? [])
  const [added, setAdded] = useState<Media[]>([])
  const [removed, setRemoved] = useState<Media[]>([])
  const [url, setUrl] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const upload = async (files: FileList | null) => {
    if (!files) return
    setError('')
    for (const file of Array.from(files)) {
      try {
        setProgress(0)
        const m = await saveFile(file, setProgress)
        setMedia((cur) => [...cur, m])
        setAdded((cur) => [...cur, m])
      } catch (e) {
        setError(msg(e))
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

  const removeMedia = (i: number) => {
    const m = media[i]
    setMedia(media.filter((_, k) => k !== i))
    if (added.includes(m)) {
      setAdded(added.filter((a) => a !== m))
      deleteFile(m).catch(() => {})
    } else setRemoved([...removed, m])
  }

  const cancel = () => {
    added.forEach((m) => deleteFile(m).catch(() => {}))
    onClose()
  }

  const save = async () => {
    setError('')
    if (!f.title.trim()) return setError('El título es obligatorio')
    if (!f.category.trim()) return setError('Elegí o escribí una categoría')
    const price = Number(f.price)
    if (isNaN(price) || price < 0) return setError('El precio no es válido')
    const options = []
    for (const line of f.options.split('\n').map((l) => l.trim()).filter(Boolean)) {
      const i = line.lastIndexOf(':')
      const p = Number(line.slice(i + 1))
      if (i < 1 || isNaN(p)) return setError(`Opción inválida: "${line}". Usá el formato nombre:precio`)
      options.push({ label: line.slice(0, i).trim(), price: p })
    }
    const data = { title: f.title.trim(), category: f.category.trim(), description: f.description.trim(), price, options, media }
    setSaving(true)
    try {
      if (service) await updateDoc(doc(db, 'services', service.id), data)
      else await addDoc(collection(db, 'services'), { ...data, visible: true, order: nextOrder })
      removed.forEach((m) => deleteFile(m).catch(() => {}))
      onClose()
    } catch (e) {
      setError('No se pudo guardar: ' + msg(e))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="my-6 w-full max-w-xl space-y-3 rounded-2xl border border-yellow-600/30 bg-[#0A0A0A] p-5">
        <div className="flex justify-between">
          <h2 className="font-serif text-2xl text-yellow-400">{service ? 'Editar servicio' : 'Nuevo servicio'}</h2>
          <button onClick={cancel}><X /></button>
        </div>
        <label className="block text-xs text-gray-400">Título<input className={`${inp} mt-1`} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-gray-400">Categoría
            <input className={`${inp} mt-1`} list="cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Elegí o escribí una nueva" />
          </label>
          <label className="block text-xs text-gray-400">Precio (ARS)
            <input className={`${inp} mt-1`} type="number" min="0" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
          </label>
        </div>
        <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        <label className="block text-xs text-gray-400">Descripción<textarea className={`${inp} mt-1`} rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <label className="block text-xs text-gray-400">Opciones (una por línea, nombre:precio)
          <textarea className={`${inp} mt-1`} rows={2} placeholder={'Por ojo:1500\nAmbos ojos:3000'} value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} />
        </label>

        <div className="rounded-xl border border-yellow-600/20 p-3">
          <p className="mb-2 text-sm text-yellow-400">Fotos y videos de demostración</p>
          <div className="mb-3 grid grid-cols-4 gap-2">
            {media.map((m, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-white/10">
                <MediaItem m={m} className="h-full w-full object-cover" />
                {m.type === 'video' && <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 text-[10px] text-yellow-400">VIDEO</span>}
                <button onClick={() => removeMedia(i)} className="absolute right-1 top-1 rounded-full bg-black/80 p-1 text-red-400"><Trash2 size={13} /></button>
              </div>
            ))}
            {media.length === 0 && <p className="col-span-4 text-xs text-gray-500">Todavía no hay archivos.</p>}
          </div>
          <label className={`${btn} w-full cursor-pointer ${progress !== null ? 'pointer-events-none opacity-50' : ''}`}>
            <Upload size={16} /> Subir imágenes o videos (video hasta 8 MB)
            <input type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
          </label>
          {progress !== null && (
            <div className="mt-2">
              <div className="h-1.5 overflow-hidden rounded bg-gray-800"><div className="h-full bg-yellow-500 transition-all" style={{ width: progress + '%' }} /></div>
              <p className="mt-1 text-xs text-gray-400">Subiendo… {progress}%</p>
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <input className={inp} placeholder="O pegá un link (imagen, mp4 o YouTube)" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addUrl()} />
            <button onClick={addUrl} className={btn}><LinkIcon size={16} /></button>
          </div>
        </div>

        {error && <p className="flex items-start gap-2 rounded-lg bg-red-500/10 p-2 text-sm text-red-300"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={cancel} className={btn}>Cancelar</button>
          <button disabled={saving || progress !== null} onClick={save} className={btnGold}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

function Categories({ cats, services, onError }: { cats: string[]; services: Service[]; onError: (m: string) => void }) {
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [val, setVal] = useState('')
  const count = (c: string) => services.filter((s) => s.category === c).length
  const saveList = (list: string[]) => setDoc(doc(db, 'settings', 'general'), { categories: list }, { merge: true })
  const run = (p: Promise<unknown>) => p.catch((e) => onError(msg(e)))

  const add = () => {
    const n = name.trim()
    if (!n || cats.includes(n)) return
    run(saveList([...cats, n]))
    setName('')
  }
  const rename = async (old: string) => {
    const n = val.trim()
    setEditing(null)
    if (!n || n === old || cats.includes(n)) return
    const b = writeBatch(db)
    services.filter((s) => s.category === old && !s.id.startsWith('seed-')).forEach((s) => b.update(doc(db, 'services', s.id), { category: n }))
    b.set(doc(db, 'settings', 'general'), { categories: cats.map((c) => (c === old ? n : c)) }, { merge: true })
    run(b.commit())
  }
  const move = (i: number, d: number) => {
    const l = [...cats]
    ;[l[i], l[i + d]] = [l[i + d], l[i]]
    run(saveList(l))
  }

  return (
    <div className={card}>
      <p className="mb-3 text-sm font-medium text-yellow-400">Categorías</p>
      <div className="mb-3 flex gap-2">
        <input className={inp} placeholder="Nueva categoría" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button onClick={add} className={btn}><FolderPlus size={16} /> Agregar</button>
      </div>
      <ul className="space-y-1.5">
        {cats.map((c, i) => (
          <li key={c} className="flex items-center gap-2 rounded-lg bg-black/40 px-3 py-2 text-sm">
            {editing === c ? (
              <input className={inp} autoFocus value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && rename(c)} onBlur={() => rename(c)} />
            ) : (
              <span className="flex-1 truncate">{c} <span className="text-xs text-gray-500">({count(c)})</span></span>
            )}
            <button disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-20"><ArrowUp size={15} /></button>
            <button disabled={i === cats.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-20"><ArrowDown size={15} /></button>
            <button onClick={() => { setEditing(c); setVal(c) }}><Pencil size={15} className="text-yellow-400" /></button>
            <button
              disabled={count(c) > 0}
              title={count(c) ? 'Movés o borrás sus servicios primero' : 'Eliminar'}
              onClick={() => run(saveList(cats.filter((x) => x !== c)))}
              className="text-red-400 disabled:opacity-20"
            ><Trash2 size={15} /></button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Dashboard({ onExit }: { onExit: () => void }) {
  const { services, settings, fromDb, error, syncing, lastSync, sync } = useCatalog()
  const [edit, setEdit] = useState<Service | 'new' | null>(null)
  const [wa, setWa] = useState(settings.whatsapp)
  const [banner, setBanner] = useState(settings.banner)
  const [flash, setFlash] = useState('')
  const [fErr, setFErr] = useState('')
  const [q, setQ] = useState('')
  const [fCat, setFCat] = useState('')
  const [fState, setFState] = useState('')
  const [fMedia, setFMedia] = useState('')
  const [sort, setSort] = useState('order')
  useEffect(() => { setWa(settings.whatsapp); setBanner(settings.banner) }, [settings])

  const cats = useMemo(() => orderedCategories(services, settings), [services, settings])
  const filtering = !!(q || fCat || fState || fMedia || sort !== 'order')
  const list = useMemo(() => {
    let l = services.filter((s) =>
      (!q || (s.title + s.description + s.category).toLowerCase().includes(q.toLowerCase())) &&
      (!fCat || s.category === fCat) &&
      (!fState || (fState === 'visible' ? s.visible !== false : s.visible === false)) &&
      (!fMedia || (fMedia === 'con' ? !!s.media?.length : !s.media?.length)),
    )
    if (sort === 'price-asc') l = [...l].sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') l = [...l].sort((a, b) => b.price - a.price)
    if (sort === 'name') l = [...l].sort((a, b) => a.title.localeCompare(b.title))
    return l
  }, [services, q, fCat, fState, fMedia, sort])

  const run = async (p: Promise<unknown>, ok?: string) => {
    try { await p; setFErr(''); if (ok) { setFlash(ok); setTimeout(() => setFlash(''), 2500) } } catch (e) { setFErr(msg(e)) }
  }
  const seed = () => run((async () => {
    const b = writeBatch(db)
    seedServices.forEach((s) => b.set(doc(collection(db, 'services')), s))
    await b.commit()
  })(), 'Servicios iniciales cargados')
  const move = (i: number, d: number) => {
    const a = services[i], c = services[i + d]
    if (!c) return
    const b = writeBatch(db)
    b.update(doc(db, 'services', a.id), { order: c.order })
    b.update(doc(db, 'services', c.id), { order: a.order })
    return run(b.commit())
  }
  const duplicate = (s: Service) =>
    run(addDoc(collection(db, 'services'), { category: s.category, description: s.description, price: s.price, options: s.options ?? [], visible: s.visible, title: s.title + ' (copia)', order: Math.max(...services.map((x) => x.order)) + 1, media: s.media?.filter((m) => !m.fileId) ?? [] }).then(() => {}), 'Servicio duplicado (los archivos subidos no se copian)')
  const remove = async (s: Service) => {
    if (!confirm(`¿Eliminar "${s.title}"?`)) return
    await run(deleteDoc(doc(db, 'services', s.id)).then(() => Promise.all((s.media ?? []).map((m) => deleteFile(m)))), 'Servicio eliminado')
  }

  const nextOrder = services.length ? Math.max(...services.map((s) => s.order ?? 0)) + 1 : 0
  const stats = { total: services.length, hidden: services.filter((s) => s.visible === false).length, noMedia: services.filter((s) => !s.media?.length).length }

  return (
    <div className="min-h-screen bg-[#050505] bg-[radial-gradient(ellipse_at_top,#17120a,#050505_55%)] pb-16 text-white">
      <header className="sticky top-0 z-30 border-b border-yellow-600/20 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-yellow-500 font-serif text-yellow-400">RB</div>
            <h1 className="font-serif text-xl text-yellow-400">Administración</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lastSync && <span className="hidden text-xs text-gray-500 sm:block">Sincronizado {lastSync.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>}
            <button onClick={sync} disabled={syncing} className={btn}><RefreshCw size={15} className={syncing ? 'animate-spin' : ''} /> Sincronizar</button>
            <a href="/" className={btn}><ExternalLink size={15} /> Ver sitio</a>
            <button onClick={() => { sessionStorage.removeItem('admin-ok'); onExit() }} className={btn}><LogOut size={15} /> Salir</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-5 px-4 pt-6">
        {(error || fErr) && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div>{fErr || error}<p className="text-xs text-red-300/70">Si persiste: verificá que Firestore esté creado en modo producción con reglas que permitan leer y escribir, y que tu conexión no bloquee firestore.googleapis.com.</p></div>
          </div>
        )}
        {flash && <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200"><Check size={16} />{flash}</div>}

        <div className="grid grid-cols-3 gap-3">
          {[['Servicios', stats.total], ['Ocultos', stats.hidden], ['Sin fotos/videos', stats.noMedia]].map(([l, n]) => (
            <div key={l} className={card}><p className="font-serif text-3xl text-yellow-400">{n}</p><p className="text-xs text-gray-400">{l}</p></div>
          ))}
        </div>

        {!fromDb && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-yellow-600/40 bg-yellow-500/5 p-4 text-sm">
            <span>La base está vacía: se muestran los servicios por defecto. Cargalos para poder editarlos.</span>
            <button onClick={seed} className={btnGold}>Cargar servicios iniciales</button>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <section className="space-y-3">
            <div className={`${card} space-y-3`}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-2.5 text-gray-500" />
                  <input className={`${inp} pl-9`} placeholder="Buscar servicio…" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <button disabled={!fromDb} onClick={() => setEdit('new')} className={btnGold}><Plus size={16} /> Nuevo</button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <select className={inp} value={fCat} onChange={(e) => setFCat(e.target.value)}>
                  <option value="">Todas las categorías</option>
                  {cats.map((c) => <option key={c}>{c}</option>)}
                </select>
                <select className={inp} value={fState} onChange={(e) => setFState(e.target.value)}>
                  <option value="">Visibles y ocultos</option><option value="visible">Solo visibles</option><option value="hidden">Solo ocultos</option>
                </select>
                <select className={inp} value={fMedia} onChange={(e) => setFMedia(e.target.value)}>
                  <option value="">Con y sin archivos</option><option value="con">Con fotos/videos</option><option value="sin">Sin fotos/videos</option>
                </select>
                <select className={inp} value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="order">Orden manual</option><option value="name">Nombre A-Z</option><option value="price-asc">Precio menor</option><option value="price-desc">Precio mayor</option>
                </select>
              </div>
              {filtering && (
                <p className="text-xs text-gray-400">
                  {list.length} de {services.length} servicios · reordenar solo está disponible con orden manual y sin filtros.{' '}
                  <button className="text-yellow-400 underline" onClick={() => { setQ(''); setFCat(''); setFState(''); setFMedia(''); setSort('order') }}>Limpiar filtros</button>
                </p>
              )}
            </div>

            {list.length === 0 && <p className="py-10 text-center text-gray-500">No hay servicios con esos filtros.</p>}
            {list.map((s) => {
              const i = services.indexOf(s)
              return (
                <div key={s.id} className={`flex items-center gap-3 ${card} !p-3 transition hover:border-yellow-600/50 ${s.visible === false ? 'opacity-55' : ''}`}>
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black">{s.media?.[0] && <MediaItem m={s.media[0]} className="h-full w-full object-cover" />}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.title}</p>
                    <p className="truncate text-xs text-gray-500">{s.category} · <span className="text-yellow-500">{money(s.price)}</span> · {s.media?.length ?? 0} archivos{s.visible === false && ' · oculto'}</p>
                  </div>
                  {fromDb && (
                    <div className="flex items-center gap-2.5 text-gray-300">
                      {!filtering && (
                        <>
                          <button disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-20" title="Subir"><ArrowUp size={16} /></button>
                          <button disabled={i === services.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-20" title="Bajar"><ArrowDown size={16} /></button>
                        </>
                      )}
                      <button title={s.visible === false ? 'Mostrar' : 'Ocultar'} onClick={() => run(updateDoc(doc(db, 'services', s.id), { visible: s.visible === false }))}>{s.visible === false ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                      <button title="Duplicar" onClick={() => duplicate(s)}><Copy size={16} /></button>
                      <button title="Editar" onClick={() => setEdit(s)}><Pencil size={16} className="text-yellow-400" /></button>
                      <button title="Eliminar" onClick={() => remove(s)}><Trash2 size={16} className="text-red-400" /></button>
                    </div>
                  )}
                </div>
              )
            })}
          </section>

          <aside className="space-y-5">
            <Categories cats={cats} services={services} onError={setFErr} />
            <div className={`${card} space-y-2`}>
              <p className="text-sm font-medium text-yellow-400">Datos generales</p>
              <label className="block text-xs text-gray-400">WhatsApp de recepción<input className={`${inp} mt-1`} placeholder="5493510000000" value={wa} onChange={(e) => setWa(e.target.value)} /></label>
              <label className="block text-xs text-gray-400">Banner de aviso / promoción<input className={`${inp} mt-1`} value={banner} onChange={(e) => setBanner(e.target.value)} /></label>
              <button className={btn} onClick={() => run(setDoc(doc(db, 'settings', 'general'), { whatsapp: wa.replace(/\D/g, ''), banner }, { merge: true }), 'Datos guardados')}>Guardar</button>
            </div>
          </aside>
        </div>
      </div>
      {edit && <Editor service={edit === 'new' ? null : edit} categories={cats} nextOrder={nextOrder} onClose={() => setEdit(null)} />}
    </div>
  )
}

export default function Admin() {
  const expected = import.meta.env.VITE_ADMIN_PASSWORD
  const [ok, setOk] = useState(!!expected && sessionStorage.getItem('admin-ok') === expected)
  return ok ? <Dashboard onExit={() => setOk(false)} /> : <Login onOk={() => setOk(true)} />
}
