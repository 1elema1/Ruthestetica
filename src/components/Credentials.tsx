import { useRef, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { Award, ArrowUp, ArrowDown, Check, Expand, Loader2, Trash2, Upload } from "lucide-react";
import { authReady, db, formatFirebaseError, withTimeout } from "../firebase";
import { deleteFile, saveFile } from "../mediaStore";
import type { Credentials, Settings } from "../types";
import { Lightbox, MediaItem } from "./MediaView";

const defaults: Credentials = {
  enabled: true,
  position: "end",
  title: "Formación que se ve en cada detalle",
  items: [],
};

export function CredentialsSection({ value }: { value?: Credentials }) {
  const [selected, setSelected] = useState<number | null>(null);
  if (!value?.enabled || !value.items.length) return null;
  return (
    <section id="formacion" className="credentials-section scroll-mt-24">
      <div className="mx-auto max-w-6xl px-4 py-20 md:py-24">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <p className="eyebrow">
              <Award size={15} /> Formación y trayectoria
            </p>
            <h2 className="mt-4 font-serif text-4xl leading-tight md:text-5xl">{value.title}</h2>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-stone-400">
            Conocé mis certificaciones e imágenes profesionales. Tocá cada imagen para verla en
            detalle.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {value.items.map((item, i) => (
            <button
              key={item.id}
              onClick={() => setSelected(i)}
              className="credential-card group text-left"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-[#eeebe3] p-5">
                <MediaItem
                  m={item.media}
                  className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute right-3 top-3 rounded-full bg-black/65 p-2 text-white">
                  <Expand size={15} />
                </span>
              </div>
              <div className="flex items-center gap-3 p-5">
                <Award size={19} className="shrink-0 text-[#c5a65f]" />
                <h3 className="font-serif text-xl text-stone-200">{item.title}</h3>
              </div>
            </button>
          ))}
        </div>
        {selected !== null && value.items[selected] && (
          <Lightbox
            media={[value.items[selected].media]}
            title={value.items[selected].title}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </section>
  );
}

const input =
  "mt-1 w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-yellow-500";

export function CredentialsManager({ settings }: { settings: Settings }) {
  const [draft, setDraft] = useState<Credentials>(settings.credentials ?? defaults);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [dirty, setDirty] = useState(false);
  const saved = useRef(draft);
  const uploads = useRef<Credentials["items"]>([]);
  const edit = (next: Credentials) => {
    setDraft(next);
    setDirty(true);
    setFeedback("");
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    const uploaded: Credentials["items"] = [];
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/"))
          throw new Error(
            "Para certificados usá imágenes JPG, PNG o WebP. Convertí tus PDF a imagen.",
          );
        setProgress(0);
        const media = await saveFile(file, setProgress, { maxPx: 1800 });
        const item = { id: crypto.randomUUID(), title: file.name.replace(/\.[^.]+$/, ""), media };
        uploaded.push(item);
        uploads.current.push(item);
      }
    } catch (e) {
      setError(formatFirebaseError(e));
    } finally {
      if (uploaded.length) {
        setDraft((d) => ({ ...d, items: [...d.items, ...uploaded] }));
        setDirty(true);
      }
      setProgress(null);
      setBusy(false);
    }
  };

  const persist = async () => {
    setBusy(true);
    setError("");
    try {
      await authReady;
      await withTimeout(
        setDoc(doc(db, "settings", "general"), { credentials: draft }, { merge: true }),
      );
      const kept = new Set(draft.items.map((item) => item.media.fileId).filter(Boolean));
      [...saved.current.items, ...uploads.current].forEach((item) => {
        if (item.media.fileId && !kept.has(item.media.fileId))
          deleteFile(item.media).catch(() => {});
      });
      saved.current = draft;
      uploads.current = [];
      setDirty(false);
      setFeedback("Sección guardada y publicada");
    } catch (e) {
      setError(formatFirebaseError(e));
    }
    setBusy(false);
  };

  return (
    <section className="admin-panel space-y-4">
      <div className="flex items-center gap-2 text-[#d6bc7f]">
        <Award size={19} />
        <h2 className="font-serif text-xl">Certificados e imágenes</h2>
      </div>
      <p className="text-xs leading-relaxed text-stone-400">
        Tu formación, con lugar propio en la web. Se publica cuando agregás al menos una imagen y
        guardás.
      </p>
      <fieldset disabled={busy} className="space-y-3 disabled:opacity-60">
        <label className="flex items-center gap-2 text-sm text-stone-300">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => edit({ ...draft, enabled: e.target.checked })}
          />
          Mostrar sección
        </label>
        <label className="block text-xs text-stone-400">
          Título de la sección
          <input
            className={input}
            value={draft.title}
            onChange={(e) => edit({ ...draft, title: e.target.value })}
          />
        </label>
        <label className="block text-xs text-stone-400">
          Ubicación
          <select
            className={input}
            value={draft.position}
            onChange={(e) =>
              edit({ ...draft, position: e.target.value as Credentials["position"] })
            }
          >
            <option value="start">Al principio, después de la portada</option>
            <option value="end">Al final, antes del pie de página</option>
          </select>
        </label>
        <div className="space-y-2">
          {draft.items.map((item, i) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-black/25 p-2">
              <div className="flex items-center gap-2">
                <MediaItem
                  m={item.media}
                  className="h-14 w-16 shrink-0 rounded bg-stone-100 object-contain"
                />
                <label className="min-w-0 flex-1 text-[11px] text-stone-400">
                  Nombre
                  <input
                    className={input}
                    value={item.title}
                    onChange={(e) =>
                      edit({
                        ...draft,
                        items: draft.items.map((x) =>
                          x.id === item.id ? { ...x, title: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
              </div>
              <div className="mt-2 flex justify-end gap-3 text-stone-400">
                <button
                  type="button"
                  aria-label="Subir imagen"
                  disabled={i === 0}
                  className="disabled:opacity-20"
                  onClick={() => {
                    const items = [...draft.items];
                    [items[i - 1], items[i]] = [items[i], items[i - 1]];
                    edit({ ...draft, items });
                  }}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  aria-label="Bajar imagen"
                  disabled={i === draft.items.length - 1}
                  className="disabled:opacity-20"
                  onClick={() => {
                    const items = [...draft.items];
                    [items[i + 1], items[i]] = [items[i], items[i + 1]];
                    edit({ ...draft, items });
                  }}
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  aria-label="Quitar imagen"
                  className="text-red-400"
                  onClick={() =>
                    edit({ ...draft, items: draft.items.filter((x) => x.id !== item.id) })
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-yellow-600/45 px-3 py-4 text-sm text-[#d6bc7f] hover:bg-yellow-500/5">
          <Upload size={16} /> Agregar imágenes o certificados
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              upload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <div className="flex items-center gap-2">
          <input
            aria-label="Enlace a imagen de certificado"
            className={input}
            placeholder="O pegá un enlace a una imagen"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            className="text-xs text-yellow-400"
            disabled={!url.trim()}
            onClick={() => {
              try {
                const parsed = new URL(url.trim());
                if (!["https:", "http:"].includes(parsed.protocol)) throw new Error();
                edit({
                  ...draft,
                  items: [
                    ...draft.items,
                    {
                      id: crypto.randomUUID(),
                      title: "Mi formación profesional",
                      media: { url: parsed.href, type: "image" },
                    },
                  ],
                });
                setUrl("");
                setError("");
              } catch {
                setError("Ingresá un enlace válido que empiece con https://");
              }
            }}
          >
            Agregar
          </button>
        </div>
      </fieldset>
      {progress !== null && (
        <p role="status" className="text-xs text-yellow-400">
          Subiendo imagen… {progress}%
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
      {feedback && (
        <p role="status" className="text-xs text-emerald-300">
          {feedback}
        </p>
      )}
      <button
        onClick={persist}
        disabled={busy || !dirty}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#E5C158] px-4 py-2.5 text-sm font-medium text-black disabled:opacity-40"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar
        sección{dirty ? " *" : ""}
      </button>
      {dirty && (
        <button
          disabled={busy}
          className="w-full text-xs text-stone-400 hover:text-white"
          onClick={() => {
            uploads.current.forEach((item) => deleteFile(item.media).catch(() => {}));
            uploads.current = [];
            setDraft(saved.current);
            setDirty(false);
            setError("");
            setFeedback("");
          }}
        >
          Descartar cambios de esta sección
        </button>
      )}
    </section>
  );
}
