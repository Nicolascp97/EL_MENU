import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import type { RecipeDifficulty } from '@/types/database'

interface RecipeFromAI {
  title: string
  description: string
  tag: string
  emoji: string
  time_minutes: number
  servings: number
  difficulty: RecipeDifficulty
  ingredients: { name: string; qty: number; unit: string; product_id?: string }[]
}

function validateRecipe(r: unknown): r is RecipeFromAI {
  if (!r || typeof r !== 'object') return false
  const recipe = r as Record<string, unknown>
  const validDifficulty = ['Fácil', 'Medio', 'Difícil']
  return (
    typeof recipe.title === 'string' && recipe.title.length <= 100 &&
    typeof recipe.description === 'string' && recipe.description.length <= 500 &&
    typeof recipe.tag === 'string' &&
    typeof recipe.emoji === 'string' &&
    typeof recipe.time_minutes === 'number' && recipe.time_minutes >= 1 && recipe.time_minutes <= 180 &&
    typeof recipe.servings === 'number' && recipe.servings >= 1 && recipe.servings <= 20 &&
    validDifficulty.includes(recipe.difficulty as string) &&
    Array.isArray(recipe.ingredients)
  )
}

export async function generateAndSaveRecipes(): Promise<{ ok: boolean; generated?: number; error?: string }> {
  const sb = createAdminClient()

  const { data: products, error: prodError } = await sb
    .from('products')
    .select('id, name, category:categories(name)')
    .eq('active', true)
    .eq('wholesale_only', false)

  if (prodError || !products?.length) {
    return { ok: false, error: 'No products found' }
  }

  const productList = products
    .map(p => {
      const cat = p.category
      const catName = Array.isArray(cat) ? (cat[0]?.name ?? 'sin categoría') : ((cat as { name: string } | null)?.name ?? 'sin categoría')
      return `- ${p.name} (id: ${p.id}, categoría: ${catName})`
    })
    .join('\n')

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `Eres el chef de "El Menú", una verdulería online de Santiago de Chile.
Genera exactamente 6 recetas frescas y saludables usando los productos disponibles.

Productos disponibles:
${productList}

Devuelve ÚNICAMENTE un array JSON válido (sin markdown, sin explicaciones) con esta estructura exacta:
[
  {
    "title": "Nombre de la receta",
    "description": "Descripción breve apetitosa (1-2 oraciones)",
    "tag": "Categoría (ej: Ensalada, Sopa, Salteado, Jugo, etc.)",
    "emoji": "🥗",
    "time_minutes": 20,
    "servings": 4,
    "difficulty": "Fácil",
    "ingredients": [
      { "name": "Lechuga", "qty": 1, "unit": "unidad", "product_id": "uuid-del-producto-si-existe" }
    ]
  }
]

Reglas:
- difficulty solo puede ser: "Fácil", "Medio" o "Difícil"
- Para cada ingrediente, busca el product_id en la lista de productos. Si no existe, omite product_id.
- Usa ingredientes reales de la lista. Puedes agregar sal, aceite, especias básicas sin product_id.
- Recetas variadas: ensaladas, sopas, jugos, salteados, cremas.
- Porciones entre 2 y 6. Tiempo entre 10 y 60 minutos.`,
      },
    ],
  })

  const raw = (message.content[0] as { type: string; text: string }).text.trim()

  let recipes: RecipeFromAI[]
  try {
    const jsonStr = raw.startsWith('[') ? raw : raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1)
    recipes = JSON.parse(jsonStr)
    if (!Array.isArray(recipes) || !recipes.every(validateRecipe)) {
      console.error('Respuesta de IA con formato inválido')
      return { ok: false, error: 'Formato de recetas inválido' }
    }
  } catch {
    return { ok: false, error: 'Failed to parse AI response' }
  }

  const { error: deactivateError } = await sb
    .from('recipes')
    .update({ active: false })
    .eq('active', true)

  if (deactivateError) {
    return { ok: false, error: 'Failed to deactivate old recipes' }
  }

  const toInsert = recipes.map(r => ({
    title: r.title,
    description: r.description,
    tag: r.tag,
    emoji: r.emoji,
    time_minutes: r.time_minutes,
    servings: r.servings,
    difficulty: r.difficulty,
    ingredients: r.ingredients,
    active: true,
    generated_at: new Date().toISOString(),
  }))

  const { error: insertError } = await sb.from('recipes').insert(toInsert)

  if (insertError) {
    console.error('Error insertando recetas:', insertError.message)
    return { ok: false, error: 'Error al guardar las recetas' }
  }

  return { ok: true, generated: toInsert.length }
}
