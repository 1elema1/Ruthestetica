import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FolderPlus,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { authReady, db, formatFirebaseError, withTimeout } from "../firebase";
import { deleteFile, saveFile, useMediaSrc } from "../mediaStore";
import { orderedCategories, useCatalog } from "../useCatalog";
import { DEFAULT_HERO_IMAGE, money, seedServices } from "../data";
import type { Media, Option, Service, Settings } from "../types";
import { MediaItem } from "./MediaView";
import { CredentialsManager } from "./Credentials";

const inp =
  "w-full rounded-lg border border-white/15 bg-black/70 px-3 py-2 text-sm text-white outline-none transition focus:border-yellow-500";
const btn =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-yellow-600/40 px-3 py-1.5 text-sm text-yellow-400 transition hover:bg-yellow-500/10 disabled:opacity-40";
const btnGold =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#E5C158] px-4 py-2 text-sm font-medium text-black transition hover:brightness-110 disabled:opacity-40";
const card = "admin-panel rounded-2xl border border-yellow-600/20 bg-white/[0.03] p-4";

const FIRESTORE_RULES_SNIPPET = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;

function Login({ onOk }: { onOk: () => void }) {
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const expected = import.meta.env.VITE_ADMIN_PASSWORD;
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,#1c1608,#050505_70%)] p-4 text-white">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (expected && pass === expected) {
            sessionStorage.setItem("admin-ok", pass);
            onOk();
          } else {
            setErr(
              expected
                ? "Contraseña incorrecta"
                : "Falta configurar VITE_ADMIN_PASSWORD en tus variables de entorno",
            );
          }
        }}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-yellow-600/30 bg-white/5 p-8 backdrop-blur-md"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-yellow-500 font-serif text-xl text-yellow-400">
          RB
        </div>
        <h1 className="text-center font-serif text-2xl text-yellow-400">Panel de administración</h1>
        <input
          className={inp}
          type="password"
          placeholder="Contraseña"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoFocus
        />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button className={`${btnGold} w-full py-2.5`}>Ingresar</button>
      </form>
    </div>
  );
}

type DraftPayload = {
  title: string;
  category: string;
  description: string;
  price: number;
  options: Option[];
  media: Media[];
  visible: boolean;
};

function InlineServiceForm({
  service,
  categories,
  onSave,
  onCancel,
  onDuplicate,
  onDelete,
}: {
  service: Service | null;
  categories: string[];
  onSave: (data: DraftPayload, removedMedia: Media[]) => Promise<void>;
  onCancel: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(service?.title ?? "");
  const [category, setCategory] = useState(service?.category ?? categories[0] ?? "Pestañas");
  const [customCat, setCustomCat] = useState(false);
  const [description, setDescription] = useState(service?.description ?? "");
  const [price, setPrice] = useState(String(service?.price ?? ""));
  const [visible, setVisible] = useState(service?.visible !== false);
  const [options, setOptions] = useState<{ label: string; price: string }[]>(
    (service?.options ?? []).map((o) => ({ label: o.label, price: String(o.price) })),
  );
  const [media, setMedia] = useState<Media[]>(service?.media ?? []);
  const [added, setAdded] = useState<Media[]>([]);
  const [removed, setRemoved] = useState<Media[]>([]);
  const [url, setUrl] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    for (const file of Array.from(files)) {
      try {
        setProgress(5);
        const m = await saveFile(file, setProgress);
        setMedia((cur) => [...cur, m]);
        setAdded((cur) => [...cur, m]);
      } catch (e) {
        setError(formatFirebaseError(e));
      }
    }
    setProgress(null);
  };

  const addUrl = () => {
    const clean = url.trim();
    if (!clean) return;
    const isVideo = /youtu\.?be|\.(mp4|webm|mov|m4v)(\?|$)/i.test(clean);
    setMedia((cur) => [...cur, { url: clean, type: isVideo ? "video" : "image" }]);
    setUrl("");
  };

  const removeMedia = (i: number) => {
    const m = media[i];
    setMedia(media.filter((_, k) => k !== i));
    if (added.includes(m)) {
      setAdded(added.filter((a) => a !== m));
      deleteFile(m).catch(() => {});
    } else {
      setRemoved([...removed, m]);
    }
  };

  const makeCover = (i: number) => {
    if (i <= 0) return;
    const next = [...media];
    const [picked] = next.splice(i, 1);
    next.unshift(picked);
    setMedia(next);
  };

  const handleCancel = () => {
    added.forEach((m) => deleteFile(m).catch(() => {}));
    onCancel();
  };

  const handleSave = async () => {
    setError("");
    if (!title.trim()) return setError("Escribí el nombre del servicio");
    if (!category.trim()) return setError("Elegí o escribí una categoría");
    const numPrice = Number(price);
    if (price === "" || isNaN(numPrice) || numPrice < 0)
      return setError("Ingresá un precio válido");

    const parsedOptions: Option[] = [];
    for (const o of options) {
      if (!o.label.trim() && !o.price.trim()) continue;
      const p = Number(o.price);
      if (!o.label.trim() || o.price === "" || isNaN(p) || p < 0) {
        return setError("Revisá las variantes: cada opción necesita nombre y precio");
      }
      parsedOptions.push({ label: o.label.trim(), price: p });
    }

    setSaving(true);
    try {
      await onSave(
        {
          title: title.trim(),
          category: category.trim(),
          description: description.trim(),
          price: numPrice,
          options: parsedOptions,
          media,
          visible,
        },
        removed,
      );
    } catch (e) {
      setError(formatFirebaseError(e));
      setSaving(false);
    }
  };

  return (
    <div
      className="space-y-4 rounded-2xl border border-yellow-500/60 bg-[#0d0b07] p-4 shadow-[0_10px_40px_-10px_rgba(212,175,55,0.25)]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-yellow-600/20 pb-3">
        <span className="font-serif text-lg text-yellow-400">
          {service ? `Editando: ${service.title}` : "Nuevo servicio"}
        </span>
        <button
          onClick={handleCancel}
          className="rounded-lg p-1 text-gray-400 hover:bg-white/5 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-gray-400 sm:col-span-2">
          Nombre del servicio
          <input
            className={`${inp} mt-1`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Pestañas Volumen Ruso"
          />
        </label>

        <div className="text-xs text-gray-400">
          <div className="flex items-center justify-between">
            <span>Categoría</span>
            <button
              type="button"
              onClick={() => {
                setCustomCat(!customCat);
                if (!customCat) setCategory("");
                else if (categories[0]) setCategory(categories[0]);
              }}
              className="text-yellow-400 hover:underline"
            >
              {customCat ? "Elegir existente" : "+ Nueva categoría"}
            </button>
          </div>
          {customCat || categories.length === 0 ? (
            <input
              className={`${inp} mt-1`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Nombre de la nueva categoría"
            />
          ) : (
            <select
              className={`${inp} mt-1`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {!categories.includes(category) && category && (
                <option value={category}>{category}</option>
              )}
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>

        <label className="block text-xs text-gray-400">
          Precio ($ ARS)
          <input
            className={`${inp} mt-1`}
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="35000"
          />
        </label>

        <label className="block text-xs text-gray-400 sm:col-span-2">
          Descripción (opcional)
          <textarea
            className={`${inp} mt-1`}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalle de la técnica, duración o recomendaciones…"
          />
        </label>
      </div>

      {/* Variantes simples sin sintaxis manual */}
      <div className="rounded-xl border border-white/10 bg-black/40 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-300">Variantes de precio (opcional)</span>
          <button
            type="button"
            onClick={() => setOptions([...options, { label: "", price: "" }])}
            className="text-xs text-yellow-400 hover:underline"
          >
            + Agregar variante
          </button>
        </div>
        {options.length > 0 && (
          <div className="mt-2 space-y-2">
            {options.map((o, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  className={inp}
                  placeholder="Ej. Por ojo"
                  value={o.label}
                  onChange={(e) =>
                    setOptions(
                      options.map((x, k) => (k === idx ? { ...x, label: e.target.value } : x)),
                    )
                  }
                />
                <input
                  className={`${inp} w-32`}
                  type="number"
                  min="0"
                  placeholder="Precio"
                  value={o.price}
                  onChange={(e) =>
                    setOptions(
                      options.map((x, k) => (k === idx ? { ...x, price: e.target.value } : x)),
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() => setOptions(options.filter((_, k) => k !== idx))}
                  className="p-1.5 text-red-400 hover:text-red-300"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fotos y videos */}
      <div className="rounded-xl border border-yellow-600/25 bg-black/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-yellow-400">
            Fotos y videos de demostración
          </span>
          <span className="text-[11px] text-gray-500">{media.length} cargados</span>
        </div>

        {media.length > 0 && (
          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {media.map((m, i) => (
              <div
                key={i}
                className="group relative aspect-square overflow-hidden rounded-lg border border-white/15 bg-black"
              >
                <MediaItem m={m} className="h-full w-full object-cover" />
                {i === 0 ? (
                  <span className="absolute bottom-1 left-1 rounded bg-yellow-500 px-1.5 py-0.5 text-[10px] font-semibold text-black">
                    Portada
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => makeCover(i)}
                    title="Usar como portada"
                    className="absolute bottom-1 left-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-yellow-300 opacity-0 transition group-hover:opacity-100"
                  >
                    <Star size={10} className="inline" /> Portada
                  </button>
                )}
                {m.type === "video" && (
                  <span className="absolute left-1 top-1 rounded bg-black/80 px-1.5 text-[10px] text-yellow-400">
                    VIDEO
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeMedia(i)}
                  className="absolute right-1 top-1 rounded-full bg-black/80 p-1 text-red-400 hover:bg-red-500 hover:text-white"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <label
            className={`${btn} cursor-pointer py-2 ${progress !== null ? "pointer-events-none opacity-50" : ""}`}
          >
            <Upload size={15} /> Subir foto o video (máx. 8 MB)
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={(e) => {
                upload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <div className="flex gap-1.5">
            <input
              className={inp}
              placeholder="O pegá link (foto, MP4 o YouTube)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addUrl();
                }
              }}
            />
            <button type="button" onClick={addUrl} className={btn} title="Agregar link">
              <LinkIcon size={15} />
            </button>
          </div>
        </div>

        {progress !== null && (
          <div className="mt-2">
            <div className="h-1.5 overflow-hidden rounded bg-gray-800">
              <div
                className="h-full bg-yellow-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-yellow-400">
              Subiendo archivo a Firestore… {progress}%
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-2.5 text-xs text-red-200">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setVisible(!visible)} className={btn}>
            {visible ? <Eye size={15} /> : <EyeOff size={15} />}
            {visible ? "Visible" : "Oculto"}
          </button>
          {onDuplicate && (
            <button type="button" onClick={onDuplicate} className={btn}>
              <Copy size={15} /> Duplicar
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
            >
              <Trash2 size={15} /> Eliminar
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={handleCancel} className={btn}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || progress !== null}
            onClick={handleSave}
            className={btnGold}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar
            cambios
          </button>
        </div>
      </div>
    </div>
  );
}

function HeroSettingsCard({
  settings,
  onFlash,
  onError,
}: {
  settings: Settings;
  onFlash: (m: string) => void;
  onError: (m: string) => void;
}) {
  const customSrc = useMediaSrc(settings.heroMedia);
  const previewSrc = settings.heroMedia ? customSrc : DEFAULT_HERO_IMAGE;
  const [progress, setProgress] = useState<number | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const saveHero = async (nextMedia: Media | null, okText: string) => {
    setBusy(true);
    const previous = settings.heroMedia;
    try {
      await authReady;
      await withTimeout(
        setDoc(doc(db, "settings", "general"), { heroMedia: nextMedia }, { merge: true }),
      );
      if (previous?.fileId && previous.fileId !== nextMedia?.fileId) {
        deleteFile(previous).catch(() => {});
      }
      onFlash(okText);
    } catch (e) {
      onError(formatFirebaseError(e));
    }
    setBusy(false);
  };

  const uploadHero = async (file?: File) => {
    if (!file) return;
    onError("");
    try {
      setProgress(5);
      const media = await saveFile(file, setProgress, { maxPx: 1600 });
      setProgress(null);
      await saveHero(media, "Foto de fondo actualizada");
    } catch (e) {
      setProgress(null);
      onError(formatFirebaseError(e));
    }
  };

  const applyUrl = async () => {
    const clean = url.trim();
    if (!clean) return;
    const isVideo = /youtu\.?be|\.(mp4|webm|mov|m4v)(\?|$)/i.test(clean);
    setUrl("");
    await saveHero(
      { url: clean, type: isVideo ? "video" : "image" },
      "Fondo de inicio actualizado",
    );
  };

  return (
    <div className={`${card} space-y-3`}>
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-medium text-yellow-400">
          <ImageIcon size={16} /> Fondo de inicio (Portada)
        </p>
        {settings.heroMedia && (
          <button
            type="button"
            disabled={busy || progress !== null}
            onClick={() => saveHero(null, "Se restauró la foto original")}
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-yellow-400"
          >
            <RotateCcw size={12} /> Restaurar original
          </button>
        )}
      </div>

      <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-yellow-600/30 bg-black">
        {previewSrc ? (
          settings.heroMedia?.type === "video" && !/youtu\.?be/i.test(previewSrc) ? (
            <video
              src={previewSrc}
              muted
              loop
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <img
              src={previewSrc}
              alt="Vista previa de portada"
              className="h-full w-full object-cover"
            />
          )
        ) : (
          <div className="h-full w-full animate-pulse bg-white/5" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />
        <div className="absolute bottom-3 left-3">
          <p className="text-[10px] uppercase tracking-[0.25em] text-yellow-500">Vista previa</p>
          <p className="font-serif text-xl leading-none text-white">
            Resalta <span className="italic text-yellow-400">tu mirada</span>
          </p>
        </div>
      </div>

      <label
        className={`${btnGold} w-full cursor-pointer ${progress !== null || busy ? "pointer-events-none opacity-50" : ""}`}
      >
        <Upload size={15} /> Subir nueva foto de fondo
        <input
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={(e) => {
            uploadHero(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>

      {progress !== null && (
        <div>
          <div className="h-1.5 overflow-hidden rounded bg-gray-800">
            <div
              className="h-full bg-yellow-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-yellow-400">Subiendo portada… {progress}%</p>
        </div>
      )}

      <div className="flex gap-1.5">
        <input
          className={inp}
          placeholder="O pegá el link de una imagen"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyUrl()}
        />
        <button type="button" disabled={!url.trim() || busy} onClick={applyUrl} className={btn}>
          Usar
        </button>
      </div>
    </div>
  );
}

function Categories({
  cats,
  services,
  fromDb,
  ensureSeeded,
  onError,
}: {
  cats: string[];
  services: Service[];
  fromDb: boolean;
  ensureSeeded: () => Promise<Service[]>;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [val, setVal] = useState("");
  const count = (c: string) => services.filter((s) => s.category === c).length;
  const saveList = (list: string[]) =>
    withTimeout(setDoc(doc(db, "settings", "general"), { categories: list }, { merge: true }));
  const run = (p: Promise<unknown>) => p.catch((e) => onError(formatFirebaseError(e)));

  const add = () => {
    const n = name.trim();
    if (!n || cats.includes(n)) return;
    run(saveList([...cats, n]));
    setName("");
  };
  const rename = async (old: string) => {
    const n = val.trim();
    setEditing(null);
    if (!n || n === old || cats.includes(n)) return;
    try {
      const current = fromDb ? services : await ensureSeeded();
      const b = writeBatch(db);
      current
        .filter((s) => s.category === old && !s.id.startsWith("seed-"))
        .forEach((s) => b.update(doc(db, "services", s.id), { category: n }));
      b.set(
        doc(db, "settings", "general"),
        { categories: cats.map((c) => (c === old ? n : c)) },
        { merge: true },
      );
      await withTimeout(b.commit());
    } catch (e) {
      onError(formatFirebaseError(e));
    }
  };
  const move = (i: number, d: number) => {
    const l = [...cats];
    [l[i], l[i + d]] = [l[i + d], l[i]];
    run(saveList(l));
  };

  return (
    <div className={card}>
      <p className="mb-3 text-sm font-medium text-yellow-400">Categorías</p>
      <div className="mb-3 flex gap-2">
        <input
          className={inp}
          placeholder="Nueva categoría"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button onClick={add} className={btn}>
          <FolderPlus size={16} /> Agregar
        </button>
      </div>
      <ul className="space-y-1.5">
        {cats.map((c, i) => (
          <li key={c} className="flex items-center gap-2 rounded-lg bg-black/40 px-3 py-2 text-sm">
            {editing === c ? (
              <input
                className={inp}
                autoFocus
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && rename(c)}
                onBlur={() => rename(c)}
              />
            ) : (
              <span className="flex-1 truncate">
                {c} <span className="text-xs text-gray-500">({count(c)})</span>
              </span>
            )}
            <button disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-20">
              <ArrowUp size={15} />
            </button>
            <button
              disabled={i === cats.length - 1}
              onClick={() => move(i, 1)}
              className="disabled:opacity-20"
            >
              <ArrowDown size={15} />
            </button>
            <button
              onClick={() => {
                setEditing(c);
                setVal(c);
              }}
            >
              <Pencil size={14} className="text-yellow-400" />
            </button>
            <button
              disabled={count(c) > 0}
              title={count(c) ? "Mové o borrá sus servicios primero" : "Eliminar"}
              onClick={() => run(saveList(cats.filter((x) => x !== c)))}
              className="text-red-400 disabled:opacity-20"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Dashboard({ onExit }: { onExit: () => void }) {
  const { services, settings, fromDb, error, permissionDenied, syncing, lastSync, sync } =
    useCatalog();
  const [openId, setOpenId] = useState<string | null>(null); // service.id o 'new'
  const [wa, setWa] = useState(settings.whatsapp);
  const [banner, setBanner] = useState(settings.banner);
  const [flash, setFlash] = useState("");
  const [fErr, setFErr] = useState("");
  const [copiedRules, setCopiedRules] = useState(false);
  const [q, setQ] = useState("");
  const [fCat, setFCat] = useState("");
  const [fState, setFState] = useState("");
  const [fMedia, setFMedia] = useState("");
  const [sort, setSort] = useState("order");
  useEffect(() => {
    setWa(settings.whatsapp);
    setBanner(settings.banner);
  }, [settings]);

  const notify = (ok: string) => {
    setFErr("");
    setFlash(ok);
    setTimeout(() => setFlash(""), 2800);
  };

  const cats = useMemo(() => orderedCategories(services, settings), [services, settings]);
  const filtering = !!(q || fCat || fState || fMedia || sort !== "order");
  const list = useMemo(() => {
    let l = services.filter(
      (s) =>
        (!q || (s.title + s.description + s.category).toLowerCase().includes(q.toLowerCase())) &&
        (!fCat || s.category === fCat) &&
        (!fState || (fState === "visible" ? s.visible !== false : s.visible === false)) &&
        (!fMedia || (fMedia === "con" ? !!s.media?.length : !s.media?.length)),
    );
    if (sort === "price-asc") l = [...l].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") l = [...l].sort((a, b) => b.price - a.price);
    if (sort === "name") l = [...l].sort((a, b) => a.title.localeCompare(b.title));
    return l;
  }, [services, q, fCat, fState, fMedia, sort]);

  // Si la base todavia no fue inicializada y el admin edita cualquier servicio,
  // guarda automaticamente el catalogo inicial en Firestore para que editar sea inmediato.
  const ensureSeeded = async (
    overrideIndex?: number,
    overrideData?: DraftPayload,
  ): Promise<Service[]> => {
    await authReady;
    const batch = writeBatch(db);
    const created: Service[] = [];
    seedServices.forEach((s, idx) => {
      const ref = doc(collection(db, "services"));
      const payload =
        idx === overrideIndex && overrideData ? { ...s, ...overrideData, order: idx } : s;
      batch.set(ref, payload);
      created.push({ id: ref.id, ...payload });
    });
    await withTimeout(batch.commit());
    return created;
  };

  const run = async (p: Promise<unknown>, ok?: string) => {
    try {
      await authReady;
      await p;
      if (ok) notify(ok);
      else setFErr("");
    } catch (e) {
      setFErr(formatFirebaseError(e));
    }
  };

  const saveService = async (target: Service | null, data: DraftPayload, removedMedia: Media[]) => {
    await authReady;
    const nextOrder = services.length ? Math.max(...services.map((s) => s.order ?? 0)) + 1 : 0;
    if (!target) {
      if (!fromDb) await ensureSeeded();
      await withTimeout(addDoc(collection(db, "services"), { ...data, order: nextOrder }));
    } else if (target.id.startsWith("seed-")) {
      const seedIdx = Number(target.id.replace("seed-", ""));
      await ensureSeeded(seedIdx, data);
    } else {
      await withTimeout(updateDoc(doc(db, "services", target.id), data));
    }
    removedMedia.forEach((m) => deleteFile(m).catch(() => {}));
    if (!cats.includes(data.category)) {
      setDoc(
        doc(db, "settings", "general"),
        { categories: [...cats, data.category] },
        { merge: true },
      ).catch(() => {});
    }
    setOpenId(null);
    notify(target ? "Servicio actualizado" : "Servicio creado");
  };

  const toggleVisible = async (s: Service) => {
    if (s.id.startsWith("seed-")) {
      const idx = Number(s.id.replace("seed-", ""));
      return run(
        ensureSeeded(idx, {
          title: s.title,
          category: s.category,
          description: s.description,
          price: s.price,
          options: s.options ?? [],
          media: s.media ?? [],
          visible: s.visible === false,
        }),
      );
    }
    await run(withTimeout(updateDoc(doc(db, "services", s.id), { visible: s.visible === false })));
  };

  const move = async (i: number, d: number) => {
    const current = fromDb ? services : await ensureSeeded();
    const a = current[i];
    const c = current[i + d];
    if (!a || !c) return;
    const b = writeBatch(db);
    b.update(doc(db, "services", a.id), { order: c.order });
    b.update(doc(db, "services", c.id), { order: a.order });
    await run(withTimeout(b.commit()));
  };

  const duplicate = async (s: Service) => {
    await run(
      (async () => {
        if (!fromDb) await ensureSeeded();
        await withTimeout(
          addDoc(collection(db, "services"), {
            category: s.category,
            description: s.description,
            price: s.price,
            options: s.options ?? [],
            visible: s.visible,
            title: s.title + " (copia)",
            order: Math.max(...services.map((x) => x.order ?? 0)) + 1,
            media: s.media?.filter((m) => !m.fileId) ?? [],
          }),
        );
        setOpenId(null);
      })(),
      "Servicio duplicado",
    );
  };

  const remove = async (s: Service) => {
    if (!confirm(`¿Eliminar "${s.title}"?`)) return;
    await run(
      (async () => {
        if (s.id.startsWith("seed-")) {
          const created = await ensureSeeded();
          const idx = Number(s.id.replace("seed-", ""));
          if (created[idx]) await withTimeout(deleteDoc(doc(db, "services", created[idx].id)));
        } else {
          await withTimeout(deleteDoc(doc(db, "services", s.id)));
          await Promise.all((s.media ?? []).map((m) => deleteFile(m)));
        }
        setOpenId(null);
      })(),
      "Servicio eliminado",
    );
  };

  const stats = {
    total: services.length,
    hidden: services.filter((s) => s.visible === false).length,
    withMedia: services.filter((s) => !!s.media?.length).length,
  };

  return (
    <div className="admin-shell min-h-screen bg-[#050505] bg-[radial-gradient(ellipse_at_top,#17120a,#050505_55%)] pb-16 text-white">
      <header className="sticky top-0 z-30 border-b border-yellow-600/20 bg-black/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-yellow-500 font-serif text-yellow-400">
              RB
            </div>
            <div>
              <h1 className="font-serif text-xl leading-none text-yellow-400">Administración</h1>
              <p className="text-[11px] text-gray-500">
                Tocá cualquier servicio para editarlo directo
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lastSync && (
              <span className="hidden text-xs text-gray-500 sm:block">
                Sincronizado{" "}
                {lastSync.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button onClick={sync} disabled={syncing} className={btn}>
              <RefreshCw size={15} className={syncing ? "animate-spin" : ""} /> Sincronizar
            </button>
            <a href="/" className={btn}>
              <ExternalLink size={15} /> Ver sitio
            </a>
            <button
              onClick={() => {
                sessionStorage.removeItem("admin-ok");
                onExit();
              }}
              className={btn}
            >
              <LogOut size={15} /> Salir
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-5 px-4 pt-6">
        <div className="admin-intro flex flex-wrap items-end justify-between gap-4 py-5">
          <div>
            <p className="eyebrow">Ruth Estética · Espacio de gestión</p>
            <h2 className="mt-3 font-serif text-4xl text-stone-100 md:text-5xl">
              Todo tu estudio, en un lugar.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
              Gestioná tus servicios, personalizá la portada y compartí tu formación profesional.
            </p>
          </div>
          <a href="#contenido-web" className={`${btn} lg:hidden`}>
            <ImageIcon size={15} /> Personalizar mi web
          </a>
        </div>
        {permissionDenied && (
          <div className="space-y-3 rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-400" />
                <div>
                  <p className="font-medium text-amber-300">
                    Falta habilitar las reglas de Firestore para guardar fotos y cambios
                  </p>
                  <p className="mt-1 text-xs text-amber-200/80">
                    Entrá a <b>Firebase Console → Firestore Database → Reglas</b>, pegá estas reglas
                    y tocá <b>Publicar</b>:
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(FIRESTORE_RULES_SNIPPET);
                  setCopiedRules(true);
                  setTimeout(() => setCopiedRules(false), 2000);
                }}
                className={btnGold}
              >
                {copiedRules ? <Check size={14} /> : <Copy size={14} />}
                {copiedRules ? "Copiado" : "Copiar reglas"}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-black/70 p-3 text-xs text-amber-200">
              {FIRESTORE_RULES_SNIPPET}
            </pre>
          </div>
        )}

        {(error || fErr) && !permissionDenied && (
          <div className="flex items-start justify-between gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
              <span>{fErr || error}</span>
            </div>
            {fErr && (
              <button onClick={() => setFErr("")} className="text-red-300 hover:text-white">
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {flash && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            <Check size={16} />
            {flash}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {[
            ["Servicios", stats.total],
            ["Con fotos/videos", stats.withMedia],
            ["Ocultos", stats.hidden],
          ].map(([l, n]) => (
            <div key={l} className={card}>
              <p className="font-serif text-3xl text-yellow-400">{n}</p>
              <p className="text-xs text-gray-400">{l}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 space-y-3">
            <div className={`${card} space-y-3`}>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search size={16} className="absolute left-3 top-2.5 text-gray-500" />
                  <input
                    className={`${inp} pl-9`}
                    placeholder="Buscar servicio por nombre o categoría…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => setOpenId(openId === "new" ? null : "new")}
                  className={btnGold}
                >
                  <Plus size={16} /> Nuevo servicio
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <select className={inp} value={fCat} onChange={(e) => setFCat(e.target.value)}>
                  <option value="">Todas las categorías</option>
                  {cats.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <select className={inp} value={fState} onChange={(e) => setFState(e.target.value)}>
                  <option value="">Visibles y ocultos</option>
                  <option value="visible">Solo visibles</option>
                  <option value="hidden">Solo ocultos</option>
                </select>
                <select className={inp} value={fMedia} onChange={(e) => setFMedia(e.target.value)}>
                  <option value="">Con y sin archivos</option>
                  <option value="con">Con fotos/videos</option>
                  <option value="sin">Sin fotos/videos</option>
                </select>
                <select className={inp} value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="order">Orden manual</option>
                  <option value="name">Nombre A-Z</option>
                  <option value="price-asc">Precio menor</option>
                  <option value="price-desc">Precio mayor</option>
                </select>
              </div>
              {filtering && (
                <p className="text-xs text-gray-400">
                  Mostrando {list.length} de {services.length} servicios.{" "}
                  <button
                    className="text-yellow-400 underline"
                    onClick={() => {
                      setQ("");
                      setFCat("");
                      setFState("");
                      setFMedia("");
                      setSort("order");
                    }}
                  >
                    Limpiar filtros
                  </button>
                </p>
              )}
            </div>

            {openId === "new" && (
              <InlineServiceForm
                service={null}
                categories={cats}
                onSave={(data, rem) => saveService(null, data, rem)}
                onCancel={() => setOpenId(null)}
              />
            )}

            {list.length === 0 && (
              <p className="py-10 text-center text-gray-500">No hay servicios con esos filtros.</p>
            )}

            {list.map((s) => {
              const i = services.indexOf(s);
              const isOpen = openId === s.id;
              if (isOpen) {
                return (
                  <InlineServiceForm
                    key={s.id}
                    service={s}
                    categories={cats}
                    onSave={(data, rem) => saveService(s, data, rem)}
                    onCancel={() => setOpenId(null)}
                    onDuplicate={() => duplicate(s)}
                    onDelete={() => remove(s)}
                  />
                );
              }

              return (
                <div
                  key={s.id}
                  onClick={() => setOpenId(s.id)}
                  className={`group flex cursor-pointer items-center gap-3 ${card} !p-3 transition hover:border-yellow-500/60 hover:bg-white/[0.06] ${
                    s.visible === false ? "opacity-55" : ""
                  }`}
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black text-gray-600">
                    {s.media?.[0] ? (
                      <MediaItem m={s.media[0]} className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon size={20} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium group-hover:text-yellow-300">
                      {s.title}
                    </p>
                    <p className="truncate text-xs text-gray-400">
                      {s.category} ·{" "}
                      <span className="font-medium text-yellow-400">{money(s.price)}</span> ·{" "}
                      {s.media?.length ? `${s.media.length} archivo(s)` : "sin muestras"}
                      {s.visible === false && " · oculto"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400">
                    {!filtering && (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                          className="rounded p-1 hover:bg-white/10 hover:text-white disabled:opacity-20"
                          title="Subir"
                        >
                          <ArrowUp size={15} />
                        </button>
                        <button
                          disabled={i === services.length - 1}
                          onClick={() => move(i, 1)}
                          className="rounded p-1 hover:bg-white/10 hover:text-white disabled:opacity-20"
                          title="Bajar"
                        >
                          <ArrowDown size={15} />
                        </button>
                      </div>
                    )}
                    <button
                      title={s.visible === false ? "Mostrar en el sitio" : "Ocultar del sitio"}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleVisible(s);
                      }}
                      className="rounded p-1 hover:bg-white/10 hover:text-white"
                    >
                      {s.visible === false ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <ChevronDown
                      size={16}
                      className="ml-1 text-yellow-500/70 transition group-hover:translate-y-0.5 group-hover:text-yellow-400"
                    />
                  </div>
                </div>
              );
            })}
          </section>

          <aside id="contenido-web" className="min-w-0 scroll-mt-28 space-y-5">
            <HeroSettingsCard settings={settings} onFlash={notify} onError={setFErr} />
            <CredentialsManager
              key={JSON.stringify(settings.credentials ?? null)}
              settings={settings}
            />

            <div className={`${card} space-y-3`}>
              <p className="text-sm font-medium text-yellow-400">Datos generales</p>
              <label className="block text-xs text-gray-400">
                WhatsApp de recepción
                <input
                  className={`${inp} mt-1`}
                  placeholder="5493510000000"
                  value={wa}
                  onChange={(e) => setWa(e.target.value)}
                />
              </label>
              <label className="block text-xs text-gray-400">
                Banner superior de aviso / promoción
                <input
                  className={`${inp} mt-1`}
                  placeholder="Ej. 15% OFF abonando en efectivo esta semana"
                  value={banner}
                  onChange={(e) => setBanner(e.target.value)}
                />
              </label>
              <button
                className={`${btnGold} w-full`}
                onClick={() =>
                  run(
                    withTimeout(
                      setDoc(
                        doc(db, "settings", "general"),
                        { whatsapp: wa.replace(/\D/g, ""), banner },
                        { merge: true },
                      ),
                    ),
                    "Datos generales guardados",
                  )
                }
              >
                <Check size={15} /> Guardar datos
              </button>
            </div>

            <Categories
              cats={cats}
              services={services}
              fromDb={fromDb}
              ensureSeeded={ensureSeeded}
              onError={setFErr}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const expected = import.meta.env.VITE_ADMIN_PASSWORD;
  const [ok, setOk] = useState(!!expected && sessionStorage.getItem("admin-ok") === expected);
  return ok ? <Dashboard onExit={() => setOk(false)} /> : <Login onOk={() => setOk(true)} />;
}
