import type { Service, Settings } from './types'

const raw: [string, string, number][] = [
  ['Pestañas', 'Pestañas Pelo a Pelo', 29000],
  ['Pestañas', 'Pestañas Efecto Kimel', 29500],
  ['Pestañas', 'Pestañas 2D', 31000],
  ['Pestañas', 'Pestañas 3D', 33500],
  ['Pestañas', 'Volumen Kuso', 35000],
  ['Pestañas', 'Mega Volumen Kuso', 42000],
  ['Pestañas', 'Efecto Kim K', 40000],
  ['Pestañas', 'Efecto Cat Eyes', 40000],
  ['Pestañas', 'Efecto Anime', 40000],
  ['Pestañas', 'Efecto Vrats', 40000],
  ['Pestañas', 'Lifting + Botox de Pestañas', 25000],
  ['Largos Extremos (16 a 20)', 'Largos Extremos en Ruso', 40000],
  ['Largos Extremos (16 a 20)', 'Largos Extremos en Mega', 45000],
  ['Volúmenes Tecnológicos', 'Volumen Brasileño (Suave)', 35000],
  ['Volúmenes Tecnológicos', 'Volumen Hawaiano (Suave)', 35000],
  ['Opcionales y Agregados', 'Agregados Deco en Color (x4 mismo color)', 10000],
  ['Opcionales y Agregados', 'Agregados Strass Deco', 1500],
  ['Opcionales y Agregados', 'Agregados Ramilletes', 3000],
  ['Opcionales y Agregados', 'Agregados de Figuras', 1500],
  ['Cejas', 'Diseño de Cejas + Depilado + Perfilado', 15000],
  ['Cejas', 'Laminado en Cejas', 15000],
  ['Cejas', 'Henna en Cejas + Depilado (Con Diseño)', 25000],
  ['Cejas', 'Henna en Cejas (Sin Diseño)', 23000],
  ['Retirado', 'Retirado de Servicios Propios', 5000],
  ['Retirado', 'Retirado de Otro Colega', 6000],
]

export const seedServices: Omit<Service, 'id'>[] = raw.map(([category, title, price], i) => ({
  category,
  title,
  description: '',
  price,
  visible: true,
  order: i,
  media: [],
  options:
    category === 'Opcionales y Agregados' && !title.includes('x4')
      ? [
          { label: 'Por ojo', price },
          { label: 'Ambos ojos', price: price * 2 },
        ]
      : [],
}))

export const defaultSettings: Settings = {
  whatsapp: import.meta.env.VITE_WHATSAPP_PHONE || '5493510000000',
  banner: '',
  categories: [],
}

export const money = (n: number) => '$' + n.toLocaleString('es-AR')
