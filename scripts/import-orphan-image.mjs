// One-off: descargar imagen desde URL temporal de kie.ai y subirla a
// Supabase Storage + actualizar products.images, para no pagar el
// crédito de regeneración.
//
// Uso: node --env-file=.env.local scripts/import-orphan-image.mjs \
//        <imageUrl> <productNameLike> <mode>
//
// Ej.: node --env-file=.env.local scripts/import-orphan-image.mjs \
//        "https://tempfile.aiquickdraw.com/.../foo.jpg" "Ajos Importados" minorista

import { createClient } from '@supabase/supabase-js'

const [imageUrl, productNameLike, mode] = process.argv.slice(2)
if (!imageUrl || !productNameLike || !mode) {
  console.error('Uso: import-orphan-image.mjs <imageUrl> <productNameLike> <minorista|mayorista>')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 1. Encontrar el producto
const { data: products, error: qErr } = await supabase
  .from('products')
  .select('id, name, images, wholesale_only')
  .ilike('name', productNameLike)
if (qErr) throw qErr
if (!products || products.length === 0) {
  console.error(`No se encontró producto con nombre "${productNameLike}"`)
  process.exit(1)
}
if (products.length > 1) {
  console.error(`Múltiples productos matchean "${productNameLike}":`)
  products.forEach(p => console.error(`  · ${p.name}`))
  process.exit(1)
}
const product = products[0]
console.log(`📦 Producto: ${product.name}`)

// 2. Descargar
console.log(`📥 Descargando ${imageUrl.slice(0, 80)}…`)
const r = await fetch(imageUrl)
if (!r.ok) throw new Error(`Download ${r.status}`)
const buffer = Buffer.from(await r.arrayBuffer())

// 3. Subir a Supabase Storage
const slug = product.name
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
const filename = `${slug}-${mode}.jpg`
console.log(`📤 Subiendo a Storage: ${filename}`)
const { error: upErr } = await supabase.storage
  .from('product-images')
  .upload(filename, buffer, {
    contentType: 'image/jpeg',
    upsert: true,
    cacheControl: '31536000',
  })
if (upErr) throw new Error(`Upload: ${upErr.message}`)

const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(filename)
const publicUrl = urlData.publicUrl

// 4. Actualizar products.images
const current = Array.isArray(product.images) ? [...product.images] : []
const targetIndex = product.wholesale_only ? 0 : mode === 'minorista' ? 0 : 1
while (current.length <= targetIndex) current.push('')
current[targetIndex] = publicUrl
const final = current.filter(Boolean)

const { error: updErr } = await supabase
  .from('products')
  .update({ images: final })
  .eq('id', product.id)
if (updErr) throw new Error(`DB update: ${updErr.message}`)

console.log(`✅ ${publicUrl}`)
