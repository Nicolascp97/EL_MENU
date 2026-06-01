export type Category = {
  id: string
  name: string
  slug: string
  order: number
  emoji: string
}

export type Product = {
  id: string
  name: string
  description: string | null
  price: number
  price_wholesale: number | null
  category_id: string
  category?: Category
  stock: number
  images: string[]
  unit: string
  unit_wholesale: string | null
  unit_qty: number
  unit_qty_wholesale: number | null
  active: boolean
  featured: boolean
  wholesale_only: boolean
  created_at: string
}

export type Zone = {
  id: string
  name: string
  communes: string[]
  delivery_price: number
  min_order: number
  min_order_wholesale: number
}

export type OrderStatus = 'nuevo' | 'preparando' | 'listo' | 'en_camino' | 'entregado' | 'cancelado'
export type OrderChannel = 'web' | 'whatsapp'
export type PaymentStatus = 'pendiente' | 'pagado' | 'fallido'
export type PaymentMethod = 'webpay' | 'transfer'
export type UserRole = 'minorista' | 'mayorista' | 'admin'
export type RecipeDifficulty = 'Fácil' | 'Medio' | 'Difícil'

export type OrderItem = {
  product_id: string
  product_name: string
  qty: number
  unit_price: number
  unit: string
  unit_qty?: number
}

export type Order = {
  id: string
  user_id: string | null
  channel: OrderChannel
  status: OrderStatus
  items: OrderItem[]
  total: number
  address: string
  commune: string
  phone: string
  notes: string | null
  payment_status: PaymentStatus
  payment_method: PaymentMethod | null
  transbank_token: string | null
  created_at: string
}

export type Profile = {
  id: string
  name: string
  phone: string | null
  address: string | null
  role: UserRole
  favorites: string[]
}

export type RecipeIngredient = {
  name: string
  qty: number
  unit: string
  product_id?: string
}

export type Recipe = {
  id: string
  title: string
  description: string | null
  tag: string
  time_minutes: number
  servings: number
  difficulty: RecipeDifficulty
  emoji: string
  ingredients: RecipeIngredient[]
  active: boolean
  generated_at: string
}

export type Conversation = {
  id: string
  wa_phone: string
  messages: { role: 'user' | 'assistant'; content: string; ts: string }[]
  status: 'activa' | 'escalada' | 'cerrada'
  order_id: string | null
  created_at: string
}
