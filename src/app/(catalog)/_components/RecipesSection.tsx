'use client'
import Link from 'next/link'
import type { Recipe, Product } from '@/types/database'
import { useCart } from '@/hooks/useCart'

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function findProduct(name: string, productId: string | undefined, products: Product[]) {
  if (productId) {
    const hit = products.find(p => p.id === productId)
    if (hit) return hit
  }
  const lower = name.toLowerCase()
  return products.find(p => p.name.toLowerCase().includes(lower))
}

const DIFFICULTY_COLOR: Record<string, string> = {
  'Fácil': '#22C55E',
  'Medio': '#F59E0B',
  'Difícil': '#EF4444',
}

export default function RecipesSection({
  recipes,
  products,
}: {
  recipes: Recipe[]
  products: Product[]
}) {
  const { addItem } = useCart()

  function addIngredients(recipe: Recipe) {
    recipe.ingredients.forEach(ing => {
      const p = findProduct(ing.name, ing.product_id, products)
      if (p) addItem(p)
    })
  }

  function matchCount(recipe: Recipe) {
    return recipe.ingredients.filter(ing =>
      findProduct(ing.name, ing.product_id, products)
    ).length
  }

  if (!recipes.length) return null

  return (
    <section className="recipes-section">
      <div className="container" style={{ paddingTop: 56, paddingBottom: 64 }}>

        {/* ── Header ── */}
        <div className="section-head">
          <div>
            <span className="section-eye">
              🤖 Recetas IA · actualización semanal
            </span>
            <h2>Qué cocinar con lo que llega fresco</h2>
            <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 8, maxWidth: '52ch' }}>
              Cada lunes generamos nuevas recetas usando los productos de temporada.
              Haz clic en un ingrediente para verlo en el catálogo.
            </p>
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="recipes-grid">
          {recipes.map(recipe => {
            const matches = matchCount(recipe)
            const diffColor = DIFFICULTY_COLOR[recipe.difficulty] ?? 'var(--gray-500)'

            return (
              <article key={recipe.id} className="recipe-card">

                {/* emoji + meta */}
                <div className="recipe-head">
                  <div className="recipe-emoji-box">{recipe.emoji}</div>
                  <div className="recipe-meta">
                    <span className="recipe-tag">{recipe.tag}</span>
                    <div className="recipe-title">{recipe.title}</div>
                    <div className="recipe-badges">
                      <span>⏱ {recipe.time_minutes} min</span>
                      <span>👤 {recipe.servings} porc.</span>
                      <span style={{ color: diffColor }}>● {recipe.difficulty}</span>
                    </div>
                  </div>
                </div>

                {/* description */}
                {recipe.description && (
                  <p className="recipe-desc">{recipe.description}</p>
                )}

                <hr className="recipe-divider" />

                {/* ingredients */}
                <div>
                  <div className="recipe-ings-label">Ingredientes</div>
                  <div className="recipe-ings">
                    {recipe.ingredients.slice(0, 7).map(ing => {
                      const linked = findProduct(ing.name, ing.product_id, products)
                      const label = `${ing.qty} ${ing.unit} ${ing.name}`
                      return linked ? (
                        <Link
                          key={ing.name}
                          href={`/catalogo?q=${encodeURIComponent(slugify(ing.name))}`}
                          className="recipe-ing"
                          title={`Ver ${ing.name} en catálogo`}
                        >
                          {label}
                        </Link>
                      ) : (
                        <span key={ing.name} className="recipe-ing" style={{ opacity: .65 }}>
                          {label}
                        </span>
                      )
                    })}
                    {recipe.ingredients.length > 7 && (
                      <span className="recipe-ing-more">
                        +{recipe.ingredients.length - 7} más
                      </span>
                    )}
                  </div>
                </div>

                {/* CTA */}
                <div className="recipe-foot">
                  <button
                    type="button"
                    className="recipe-add"
                    disabled={matches === 0}
                    onClick={() => addIngredients(recipe)}
                    title={
                      matches === 0
                        ? 'Ningún ingrediente disponible en el catálogo actualmente'
                        : `Agregar ${matches} ingrediente${matches > 1 ? 's' : ''} al carrito`
                    }
                  >
                    🛒{' '}
                    {matches > 0
                      ? `Agregar ${matches} ingrediente${matches > 1 ? 's' : ''}`
                      : 'Sin stock disponible'}
                  </button>
                </div>

              </article>
            )
          })}
        </div>

      </div>
    </section>
  )
}
