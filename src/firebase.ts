import { initializeApp } from 'firebase/app'
import { initializeFirestore } from 'firebase/firestore'
import { getAuth, signInAnonymously } from 'firebase/auth'

const env = import.meta.env

// Usa variables VITE_FIREBASE_* si estan definidas en Vercel/.env y cae en la
// configuracion publica del proyecto ruthestetic-be0ed si faltan en el entorno.
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyBNNayOygmkXIGbwzYtquA_ySb8P65Ut6o',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'ruthestetic-be0ed.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'ruthestetic-be0ed',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'ruthestetic-be0ed.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '899668993904',
  appId: env.VITE_FIREBASE_APP_ID || '1:899668993904:web:511c697a7538d4348951b5',
}

const app = initializeApp(firebaseConfig)

// Auto-detecta long polling cuando redes, proxies o iframes bloquean WebChannel
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
})

// Si las reglas de Firestore piden request.auth != null y Auth anonimo esta activo,
// esto autentica en segundo plano sin pedir usuario. Si no esta activo, se ignora.
const auth = getAuth(app)
export const authReady = signInAnonymously(auth).then(() => true).catch(() => false)

export function formatFirebaseError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  const raw = e instanceof Error ? e.message : String(e)
  if (code === 'permission-denied' || /Missing or insufficient permissions/i.test(raw)) {
    return 'Permiso denegado en Firestore (permission-denied). Tenés que habilitar las reglas de lectura y escritura en Firebase Console → Firestore Database → Reglas.'
  }
  if (code === 'unavailable' || /Failed to get document|offline/i.test(raw)) {
    return 'No se pudo conectar con Firestore. Revisá tu conexión o que ningún bloqueador frene firestore.googleapis.com.'
  }
  if (code === 'resource-exhausted' || /exceeds the maximum allowed size/i.test(raw)) {
    return 'El archivo supera el tamaño máximo por documento en Firestore.'
  }
  return raw || 'Ocurrió un error inesperado'
}

export function withTimeout<T>(promise: Promise<T>, ms = 20000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Tiempo de espera agotado al guardar en Firestore. Verificá las reglas de Firestore y tu conexión.'))
    }, ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}
