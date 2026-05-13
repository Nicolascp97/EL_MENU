// ============================================================
// El Menú — Generador de imágenes de productos con Kie.ai
// (nano-banana-2). Sube las imágenes a Supabase Storage y
// actualiza products.images en DB.
//
// Uso:
//   node --env-file=.env.local scripts/generate-product-images.mjs --pilot
//   node --env-file=.env.local scripts/generate-product-images.mjs --all
//   node --env-file=.env.local scripts/generate-product-images.mjs --only=tomate-oferta,limon
//   node --env-file=.env.local scripts/generate-product-images.mjs --mode=mayorista
//   node --env-file=.env.local scripts/generate-product-images.mjs --dry-run
//
// Flags:
//   --pilot       Solo el primer producto que requiera ambos bgs (2 imágenes de prueba)
//   --all         Procesa todos los productos
//   --only=...    Lista separada por coma de slugs
//   --mode=...    "minorista" | "mayorista" | "both" (default: both)
//   --dry-run     No llama a Kie ni sube nada
//   --force       Re-genera incluso si ya existe la imagen
//
// Env vars (de .env.local):
//   KIE_API_KEY                        (obligatoria — la misma de NANI)
//   NEXT_PUBLIC_SUPABASE_URL           (obligatoria)
//   SUPABASE_SERVICE_ROLE_KEY          (obligatoria — bypasea RLS)
// ============================================================

import { createClient } from '@supabase/supabase-js'

// ─── Config ─────────────────────────────────────────────────
const KIE_API_URL = 'https://api.kie.ai/api/v1/jobs/createTask'
const KIE_STATUS_URL = id => `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${id}`
const KIE_MODEL = 'nano-banana-2'
const ASPECT_RATIO = '1:1'
const RESOLUTION = '1K'
const OUTPUT_FORMAT = 'jpg'
const BUCKET = 'product-images'

const POLL_INTERVAL_MS = 4000
// kie.ai puede demorar hasta ~10 min cuando el queue está cargado.
// Subimos a 12 min para no abandonar tasks que ya pagamos.
const POLL_MAX_MS = 720000
const BETWEEN_TASKS_MS = 1000
const MAX_RETRIES = 3

const PROMPT_MINORISTA = `Fotografía profesional de producto para e-commerce de verdulería.
Sujeto: {producto}.
Fondo: color crema marfil muy claro #F5EFE0, seamless, sin textura, sin gradiente, completamente uniforme.
Cámara: vista cenital con un ángulo leve de 30 grados.
Iluminación: luz natural suave desde arriba-izquierda creando una sombra muy sutil debajo del producto.
Composición: producto centrado, ocupando el 70% del cuadro, formato cuadrado.
Estilo: fotorrealista, alta calidad, limpio, minimalista, vibrante pero natural.
PROHIBIDO: texto, etiquetas, logos, marcas, watermarks, envases con texto visible, manos, personas, decoraciones.`

const PROMPT_MAYORISTA = `Fotografía profesional de producto para catálogo mayorista de verdulería.
Sujeto: {producto}.
Fondo: color arena tibio #E8DCC4, seamless, sin textura, sin gradiente, completamente uniforme.
Cámara: vista cenital con un ángulo leve de 30 grados.
Iluminación: luz natural suave desde arriba-izquierda creando una sombra muy sutil debajo del producto.
Composición: producto centrado, ocupando el 70% del cuadro, formato cuadrado.
Estilo: fotorrealista, alta calidad, limpio, profesional, abundancia.
PROHIBIDO: texto, etiquetas, logos, marcas, watermarks, envases con texto visible, manos, personas, decoraciones.`

// ─── CLI ────────────────────────────────────────────────────
const argv = parseArgs(process.argv.slice(2))
const dryRun = argv.has('dry-run')
const force = argv.has('force')
const pilot = argv.has('pilot')
const all = argv.has('all')
const onlySlugs = (argv.get('only') ?? '').split(',').filter(Boolean)
const modeFilter = argv.get('mode') ?? 'both'

if (!pilot && !all && onlySlugs.length === 0) {
  console.error('❌ Decime qué hacer: pasame --pilot, --all o --only=slug1,slug2.')
  process.exit(1)
}

// ─── Clientes ───────────────────────────────────────────────
const requireEnv = name => {
  const v = process.env[name]
  if (!v) {
    console.error(`❌ Falta env var ${name}. Configurala en .env.local.`)
    process.exit(1)
  }
  return v
}

const KIE_API_KEY = dryRun ? '' : requireEnv('KIE_API_KEY')
const supabase = createClient(
  requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY')
)

// ─── Main ───────────────────────────────────────────────────
async function main() {
  console.log(`🍅 El Menú — generación de imágenes (${dryRun ? 'DRY RUN' : 'LIVE'})\n`)

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, unit, images, wholesale_only, price_wholesale')
    .order('name')
  if (error) throw error

  // Targets
  const targets = []
  for (const p of products) {
    const slug = slugify(p.name)
    const modes = []
    if (p.wholesale_only) modes.push('mayorista')
    else if (p.price_wholesale == null) modes.push('minorista')
    else modes.push('minorista', 'mayorista')

    for (const mode of modes) {
      if (modeFilter !== 'both' && modeFilter !== mode) continue
      targets.push({ product: p, slug, mode })
    }
  }

  let pending = targets
  if (onlySlugs.length > 0) {
    pending = pending.filter(t => onlySlugs.includes(t.slug))
  }
  if (pilot) {
    const dual = products.find(p => !p.wholesale_only && p.price_wholesale != null)
    if (!dual) {
      console.error('❌ No hay productos duales para pilot.')
      process.exit(1)
    }
    const dualSlug = slugify(dual.name)
    pending = pending.filter(t => t.slug === dualSlug)
    console.log(`🧪 Pilot: ${dualSlug} (genera bg minorista + mayorista)\n`)
  }

  if (!force) {
    const before = pending.length
    pending = pending.filter(t => {
      const idx = t.product.wholesale_only ? 0 : t.mode === 'minorista' ? 0 : 1
      return !t.product.images?.[idx]
    })
    if (before > pending.length) {
      console.log(`⏭️  Salteados ${before - pending.length} ya generados (--force para regenerar)\n`)
    }
  }

  console.log(`📋 Targets: ${pending.length}\n`)
  if (pending.length === 0) {
    console.log('✅ Nada que hacer.')
    return
  }

  let ok = 0
  let fail = 0
  const failures = []

  for (let i = 0; i < pending.length; i++) {
    const { product, slug, mode } = pending[i]
    const label = `[${i + 1}/${pending.length}] ${slug} (${mode})`
    try {
      if (dryRun) {
        const prompt = buildPrompt(product, mode)
        console.log(`🔍 ${label}\n   ${prompt.slice(0, 120)}…\n`)
        ok++
      } else {
        const url = await generateAndStore(product, slug, mode)
        console.log(`✅ ${label} → ${url}`)
        ok++
        await sleep(BETWEEN_TASKS_MS)
      }
    } catch (e) {
      console.error(`❌ ${label} — ${e?.message ?? e}`)
      fail++
      failures.push({ slug, mode, error: e?.message ?? String(e) })
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`✅ OK:    ${ok}`)
  console.log(`❌ Fail:  ${fail}`)
  if (failures.length > 0) {
    console.log('\nFallos:')
    failures.forEach(f => console.log(`  · ${f.slug} (${f.mode}): ${f.error}`))
  }
}

// ─── Pipeline por producto ─────────────────────────────────

async function generateAndStore(product, slug, mode) {
  const prompt = buildPrompt(product, mode)

  // 1. Crear task en Kie.ai + poll hasta completar + bajar imagen
  const imageBuffer = await kieGenerate(prompt)

  // 2. Subir a Supabase Storage
  const filename = `${slug}-${mode}.${OUTPUT_FORMAT}`
  const contentType = OUTPUT_FORMAT === 'jpg' ? 'image/jpeg' : `image/${OUTPUT_FORMAT}`
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(filename, imageBuffer, {
      contentType,
      upsert: true,
      cacheControl: '31536000',
    })
  if (upErr) throw new Error(`Storage upload: ${upErr.message}`)

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filename)
  const publicUrl = urlData.publicUrl

  // 3. Actualizar products.images con el índice correcto
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

  product.images = final
  return publicUrl
}

// ─── Kie.ai client ─────────────────────────────────────────

async function kieGenerate(prompt) {
  let lastErr
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const taskId = await kieCreateTask(prompt)
      const imageUrl = await kiePollTask(taskId)
      const buffer = await downloadAsBuffer(imageUrl)
      return buffer
    } catch (e) {
      lastErr = e
      const msg = e?.message ?? String(e)
      if (msg.includes('429') || msg.toLowerCase().includes('rate')) {
        const wait = 3000 * Math.pow(2, attempt - 1)
        console.log(`   ⏳ Rate limit, esperando ${wait}ms…`)
        await sleep(wait)
        continue
      }
      if (attempt < MAX_RETRIES) {
        console.log(`   🔁 Reintento ${attempt}/${MAX_RETRIES - 1}: ${msg.slice(0, 80)}`)
        await sleep(2000)
        continue
      }
    }
  }
  throw lastErr ?? new Error('Generación falló sin error específico')
}

async function kieCreateTask(prompt) {
  const r = await fetch(KIE_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: KIE_MODEL,
      input: {
        prompt,
        aspect_ratio: ASPECT_RATIO,
        resolution: RESOLUTION,
        output_format: OUTPUT_FORMAT,
      },
    }),
  })
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    throw new Error(`Kie create ${r.status}: ${txt.slice(0, 200)}`)
  }
  const data = await r.json()
  // Acepta varias formas: { taskId }, { id }, { data: { taskId } }, etc.
  const taskId =
    data.taskId ?? data.id ?? data?.data?.taskId ?? data?.data?.id
  if (!taskId) throw new Error(`Sin taskId en respuesta: ${JSON.stringify(data).slice(0, 200)}`)
  return taskId
}

async function kiePollTask(taskId) {
  const start = Date.now()
  while (Date.now() - start < POLL_MAX_MS) {
    const r = await fetch(KIE_STATUS_URL(taskId), {
      headers: { Authorization: `Bearer ${KIE_API_KEY}` },
    })
    if (!r.ok) {
      await sleep(POLL_INTERVAL_MS)
      continue
    }
    const json = await r.json()
    const payload = json?.data ?? {}
    // Estados oficiales de kie.ai: waiting | queuing | generating | success | fail
    const state = String(payload?.state ?? '').toLowerCase()

    if (state === 'success') {
      // resultJson viene como string JSON, hay que parsearlo
      let parsed
      try {
        parsed = typeof payload.resultJson === 'string'
          ? JSON.parse(payload.resultJson)
          : payload.resultJson
      } catch {
        throw new Error(`No pude parsear resultJson: ${payload.resultJson}`)
      }
      const url = parsed?.resultUrls?.[0]
      if (!url) throw new Error(`Sin resultUrls: ${JSON.stringify(parsed).slice(0, 200)}`)
      return url
    }
    if (state === 'fail') {
      throw new Error(`Task fail: ${payload.failCode ?? '?'} ${payload.failMsg ?? ''}`)
    }
    // waiting | queuing | generating → seguir esperando
    await sleep(POLL_INTERVAL_MS)
  }
  throw new Error(`Timeout (${POLL_MAX_MS}ms) esperando task ${taskId}`)
}

async function downloadAsBuffer(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Download ${r.status}: ${url}`)
  const arr = new Uint8Array(await r.arrayBuffer())
  return Buffer.from(arr)
}

// ─── Helpers ────────────────────────────────────────────────

function buildPrompt(product, mode) {
  const desc = productSubject(product)
  const base = mode === 'mayorista' ? PROMPT_MAYORISTA : PROMPT_MINORISTA
  return base.replace('{producto}', desc)
}

function productSubject(p) {
  const n = p.name.trim()
  const u = (p.unit ?? '').trim().toLowerCase()

  if (/caja/i.test(n) || /caja/i.test(u)) {
    return `una caja de madera abierta llena de ${stripContainer(n)} frescos`
  }
  if (/saco/i.test(n) || /saco/i.test(u)) {
    return `un saco de yute abierto de ${stripContainer(n)} frescos`
  }
  if (/malla/i.test(n) || /malla/i.test(u)) {
    return `una malla roja de mercado con ${stripContainer(n)}`
  }
  if (/pack/i.test(n) || /^[0-9]+ unid/.test(u)) {
    const qty = (u.match(/(\d+)/) ?? [, '3'])[1]
    return `${qty} unidades de ${stripContainer(n)} frescos agrupados`
  }
  if (/docena/i.test(u)) {
    return `12 unidades de ${stripContainer(n)} agrupadas`
  }
  if (/^1 unid|^1 uni/.test(u)) {
    return `una sola unidad de ${stripContainer(n)} fresco`
  }
  if (/kg/i.test(u) || /gr/i.test(u) || /paq/i.test(u)) {
    return `${stripContainer(n)} frescos a granel, formato ${u}`
  }
  return `${n}, formato ${u}`
}

function stripContainer(name) {
  return name
    .replace(/^(Caja|Saco|Malla|Pack)\s+/i, '')
    .replace(/\s+(Caja|Saco|Malla|Pack|Docena)\b/i, '')
    .replace(/\s+\d+\s*(u|unid|kg|gr|g|paq)?\b/i, '')
    .trim()
}

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseArgs(argv) {
  const flags = new Set()
  const kv = new Map()
  for (const a of argv) {
    if (a.startsWith('--')) {
      const stripped = a.slice(2)
      if (stripped.includes('=')) {
        const [k, v] = stripped.split('=', 2)
        kv.set(k, v)
        flags.add(k)
      } else {
        flags.add(stripped)
      }
    }
  }
  return {
    has: name => flags.has(name),
    get: name => kv.get(name),
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
