'use client'
import Link from 'next/link'
import type { Recipe, Product } from '@/types/database'
import { useCart } from '@/hooks/useCart'

function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function findProduct(name: string, productId: string | undefined, products: Product[]) {
  if (productId) {
    const byId = products.find(p => p.id === productId)
    if (byId) return byId
  }
  return products.find(p => p.name.toLowerCase().includes(name.toLowerCase()))
}

export default function RecipesSection({ recipes, products }: { recipes: Recipe[]; products: Product[] }) {
  const { addItem } = useCart()

  function addIngredients(recipe: Recipe) {
    recipe.ingredients.forEach(ing => {
      const p = findProduct(ing.name, ing.product_id, products)
      if (p) addItem(p)
    })
  }

  function countMatches(recipe: Recipe) {
    return recipe.ingredients.filter(ing => findProduct(ing.name, ing.product_id, products)).length
  }

  return (
    <section style={{ padding: '56px 0' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 28, flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--green-700)', marginBottom: 8, display: 'inline-block' }}>
              🤖 Generadas por IA
            </span>
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700, fontSize: 'clamp(28px, 3vw, 40px)', lineHeight: 1.1, margin: 0, color: 'var(--green-900)' }}>
              Recetas de la semana
            </h2>
          </div>
        </div>
        <div className="recipes-grid">
          {recipes.map(recipe => {
            const matches = countMatches(recipe)
            return (
              <div key={recipe.id} className="recipe-card">
                <div className="recipe-head">
                  <div className="recipe-emoji">{recipe.emoji}</div>
                  <div className="recipe-meta">
                    <div className="recipe-tag">{recipe.tag}</div>
                    <div className="recipe-title">{recipe.title}</div>
                    <div className="recipe-info">
                      <span>⏱ {recipe.time_minutes} min</span>
                      <span>👤 {recipe.servings} porciones</span>
                      <span>{recipe.difficulty}</span>
                    </div>
                  </div>
                </div>
                {recipe.description && (
                  <div className="recipe-desc">{recipe.description}</div>
                )}
                <div className="recipe-ings">
                  {recipe.ingredients.slice(0, 6).map(ing => (
                    <Link
                      key={ing.name}
                      href={`/catalogo?q=${encodeURIComponent(slugify(ing.name))}`}
                      className="recipe-ing"
                    >
                      {ing.qty} {ing.unit} {ing.name}
                    </Link>
                  ))}
                  {recipe.ingredients.length > 6 && (
                    <span className="recipe-ing">+{recipe.ingredients.length - 6} más</span>
                  )}
                </div>
                <div className="recipe-foot">
                  <button
                    type="button"
                    className="recipe-add"
                    disabled={matches === 0}
                    onClick={() => addIngredients(recipe)}
                    title={matches === 0 ? 'No hay productos coincidentes disponibles' : undefined}
                  >
                    🛒 Agregar ingredientes
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
