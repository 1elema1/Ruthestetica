export type Media = { url: string; type: 'image' | 'video'; fileId?: string; mime?: string }
export type Option = { label: string; price: number }
export type Service = {
  id: string
  category: string
  title: string
  description: string
  price: number
  options?: Option[]
  media?: Media[]
  visible: boolean
  order: number
}
export type Settings = { whatsapp: string; banner: string; categories?: string[] }
