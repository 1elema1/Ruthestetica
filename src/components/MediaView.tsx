import { useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { Media } from '../types'
import { useMediaSrc } from '../mediaStore'

export function youtubeId(url: string) {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)
  return m?.[1]
}

export function MediaItem({ m, controls = false, className = '' }: { m: Media; controls?: boolean; className?: string }) {
  const src = useMediaSrc(m)
  if (!src) return <div className={`${className} animate-pulse bg-white/5`} />
  if (m.type === 'image') return <img src={src} alt="" className={className} loading="lazy" />
  const yt = youtubeId(src)
  if (yt)
    return controls ? (
      <iframe
        src={`https://www.youtube.com/embed/${yt}`}
        className={className}
        allow="autoplay; encrypted-media; fullscreen"
        allowFullScreen
      />
    ) : (
      <img src={`https://img.youtube.com/vi/${yt}/hqdefault.jpg`} alt="" className={className} />
    )
  return <video src={src} className={className} controls={controls} muted={!controls} preload="metadata" playsInline />
}

export function Lightbox({ media, title, onClose }: { media: Media[]; title: string; onClose: () => void }) {
  const [i, setI] = useState(0)
  const go = (d: number) => setI((i + d + media.length) % media.length)
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <button className="absolute right-4 top-4 rounded-full border border-yellow-600/40 p-2 text-yellow-400" onClick={onClose}>
        <X size={20} />
      </button>
      <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <p className="mb-3 text-center font-serif text-lg text-yellow-400">{title}</p>
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-yellow-600/30 bg-black">
          <MediaItem key={i} m={media[i]} controls className="h-full w-full object-contain" />
          {media.length > 1 && (
            <>
              <button onClick={() => go(-1)} className="absolute left-2 rounded-full bg-black/60 p-2 text-yellow-400">
                <ChevronLeft />
              </button>
              <button onClick={() => go(1)} className="absolute right-2 rounded-full bg-black/60 p-2 text-yellow-400">
                <ChevronRight />
              </button>
            </>
          )}
        </div>
        <div className="mt-3 flex justify-center gap-2 overflow-x-auto">
          {media.map((m, k) => (
            <button
              key={k}
              onClick={() => setI(k)}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 ${k === i ? 'border-yellow-500' : 'border-transparent opacity-60'}`}
            >
              <MediaItem m={m} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
