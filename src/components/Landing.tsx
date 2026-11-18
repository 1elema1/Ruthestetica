import { useMemo, useState } from 'react'
import { Minus, Play, Plus, ShoppingBag, Trash2, X, Images, MessageCircle } from 'lucide-react'
import { useCatalog } from '../useCatalog'
import { money } from '../data'
import type { Service } from '../types'
import { Lightbox, MediaItem } from './MediaView'

type Line = { key: string; title: string; price: number; qty: number }

export default function Landing() {
  const { services, settings } = useCatalog()
  const [cat, setCat] = useState('Todos')
  const [cart, setCart] = useState<Line[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [when, setWhen] = useState('')
  const [lightbox, setLightbox] = useState<Service | null>(null)
  const [choice, setChoice] = useState<Record<string, number>>({})

  const visible = services.filter((s) => s.visible !== false)
  const cats = useMemo(() => [...new Set(visible.map((s) => s.category))], [visible])
  const shown = cat === 'Todos' ? visible : visible.filter((s) => s.category === cat)
  const count = cart.reduce((a, l) => a + l.qty, 0)
  const total = cart.reduce((a, l) => a + l.qty * l.price, 0)

  const add = (s: Service) => {
    const o = s.options?.length ? s.options[choice[s.id] ?? 0] : null
    const key = s.id + (o ? o.label : '')
    const title = o ? `${s.title} (${o.label})` : s.title
    const price = o ? o.price : s.price
    setCart((c) => (c.find((l) => l.key === key) ? c.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l)) : [...c, { key, title, price, qty: 1 }]))
  }
  const setQty = (key: string, d: number) =>
    setCart((c) => c.map((l) => (l.key === key ? { ...l, qty: l.qty + d } : l)).filter((l) => l.qty > 0))

  const send = () => {
    const lines = cart.map((l) => `• ${l.title}${l.qty > 1 ? ` x${l.qty}` : ''} - ${money(l.price * l.qty)}`).join('\n')
    const msg = `✨ *NUEVA RESERVA DE TURNO - RUTH ESTÉTICA* ✨\n\n👤 *Cliente:* ${name || '-'}\n📅 *Fecha/Hora tentativa:* ${when || '-'}\n\n📋 *Servicios Seleccionados:*\n${lines}\n\n💰 *TOTAL ESTIMADO:* ${money(total)}\n\nA la espera de confirmación de disponibilidad. ¡Muchas gracias!`
    window.open(`https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="min-h-screen bg-[#050505] text-[#F9FAFB]">
      {settings.banner && (
        <div className="bg-yellow-600/90 px-4 py-2 text-center text-sm font-medium text-black">{settings.banner}</div>
      )}
      <header className="sticky top-0 z-40 border-b border-yellow-600/20 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-yellow-500 font-serif text-lg text-yellow-400">RB</div>
            <span className="hidden font-serif text-lg tracking-wide text-yellow-400 sm:block">Ruth Estética</span>
          </div>
          <nav className="hidden gap-5 text-sm text-gray-300 md:flex">
            {cats.slice(0, 5).map((c) => (
              <button key={c} onClick={() => { setCat(c); go('servicios') }} className="hover:text-yellow-400">
                {c.replace(/ \(.*\)/, '')}
              </button>
            ))}
          </nav>
          <button onClick={() => setOpen(true)} className="relative flex items-center gap-2 rounded-full border border-yellow-600/50 px-4 py-2 text-sm text-yellow-400 hover:bg-yellow-500/10">
            <ShoppingBag size={18} /> Mi pedido
            {count > 0 && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500 text-xs font-bold text-black">{count}</span>}
          </button>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top,#1c1608,#050505_70%)] px-4 py-28 text-center">
        <p className="mb-4 text-xs uppercase tracking-[0.4em] text-yellow-600">Estética profesional</p>
        <h1 className="font-serif text-5xl leading-tight text-[#E5C158] md:text-7xl">Ruth Estética</h1>
        <p className="mt-2 font-serif text-2xl italic text-gray-200 md:text-3xl">Resalta tu Mirada</p>
        <p className="mx-auto mt-6 max-w-xl text-gray-400">Pestañas, cejas y técnicas de volumen con acabado de lujo, pensadas para tu estilo.</p>
        <button onClick={() => go('servicios')} className="mt-10 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#E5C158] px-8 py-3 font-medium text-black shadow-[0_0_30px_rgba(212,175,55,0.35)] transition hover:shadow-[0_0_45px_rgba(212,175,55,0.6)]">
          Ver Servicios y Reservar
        </button>
      </section>

      <section id="servicios" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-24">
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {['Todos', ...cats].map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-4 py-1.5 text-sm transition ${cat === c ? 'border-yellow-500 bg-yellow-500 text-black' : 'border-yellow-600/30 text-gray-300 hover:border-yellow-500'}`}>
              {c}
            </button>
          ))}
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((s) => {
            const media = s.media ?? []
            return (
              <article key={s.id} className="flex flex-col overflow-hidden rounded-2xl border border-yellow-600/30 bg-white/[0.04] backdrop-blur-md transition hover:border-yellow-500/60">
                {media.length > 0 && (
                  <button onClick={() => setLightbox(s)} className="group relative aspect-[16/10] overflow-hidden bg-black">
                    <MediaItem m={media[0]} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    {media[0].type === 'video' && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30"><Play className="fill-yellow-400 text-yellow-400" size={36} /></span>
                    )}
                    <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-xs text-yellow-400"><Images size={13} /> {media.length}</span>
                  </button>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <span className="text-xs uppercase tracking-widest text-yellow-600">{s.category}</span>
                  <h3 className="mt-1 font-serif text-xl text-[#F9FAFB]">{s.title}</h3>
                  {s.description && <p className="mt-2 text-sm text-gray-300">{s.description}</p>}
                  {!!s.options?.length && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {s.options.map((o, i) => (
                        <button key={i} onClick={() => setChoice({ ...choice, [s.id]: i })} className={`rounded-full border px-3 py-1 text-xs ${(choice[s.id] ?? 0) === i ? 'border-yellow-500 bg-yellow-500/15 text-yellow-300' : 'border-gray-700 text-gray-400'}`}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-5">
                    <span className="text-xl font-semibold text-yellow-400">{money(s.options?.length ? s.options[choice[s.id] ?? 0].price : s.price)}</span>
                    <button onClick={() => add(s)} className="rounded-full border border-yellow-500 px-4 py-2 text-sm text-yellow-400 transition hover:bg-yellow-500 hover:text-black hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]">
                      Agregar al pedido
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <footer className="border-t border-yellow-600/20 py-8 text-center text-sm text-gray-500">
        © Ruth Estética · <a href="/admin" className="text-gray-600 hover:text-yellow-500">Admin</a>
      </footer>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-full max-w-md flex-col border-l border-yellow-600/30 bg-[#0A0A0A] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-2xl text-yellow-400">Tu pedido</h2>
              <button onClick={() => setOpen(false)}><X className="text-gray-400" /></button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto">
              {cart.length === 0 && <p className="py-10 text-center text-gray-500">Todavía no agregaste servicios.</p>}
              {cart.map((l) => (
                <div key={l.key} className="rounded-xl border border-yellow-600/20 p-3">
                  <p className="text-sm">{l.title}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-yellow-400">
                      <button onClick={() => setQty(l.key, -1)} className="rounded-full border border-yellow-600/40 p-1"><Minus size={14} /></button>
                      <span className="w-5 text-center text-sm">{l.qty}</span>
                      <button onClick={() => setQty(l.key, 1)} className="rounded-full border border-yellow-600/40 p-1"><Plus size={14} /></button>
                    </div>
                    <span className="text-yellow-400">{money(l.price * l.qty)}</span>
                    <button onClick={() => setQty(l.key, -l.qty)} className="text-gray-500 hover:text-red-400"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3 border-t border-yellow-600/20 pt-4">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la clienta" className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm outline-none focus:border-yellow-500" />
              <textarea value={when} onChange={(e) => setWhen(e.target.value)} rows={2} placeholder="Fecha / hora preferida y notas" className="w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm outline-none focus:border-yellow-500" />
              <div className="flex justify-between text-lg"><span>Total</span><span className="font-semibold text-yellow-400">{money(total)}</span></div>
              <button disabled={!cart.length} onClick={send} className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#E5C158] py-3 font-medium text-black disabled:opacity-40">
                <MessageCircle size={18} /> Enviar Reserva por WhatsApp
              </button>
            </div>
          </aside>
        </div>
      )}
      {lightbox && <Lightbox media={lightbox.media!} title={lightbox.title} onClose={() => setLightbox(null)} />}
    </div>
  )
}
