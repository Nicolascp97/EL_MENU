'use client'
import type { Category } from '@/types/database'
import { cn } from '@/lib/utils'

type Props = {
  categories: Category[]
  selected: string | null
  onChange: (slug: string | null) => void
}

export default function CategoryFilter({ categories, selected, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      <button
        onClick={() => onChange(null)}
        className={cn(
          'shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap',
          !selected
            ? 'text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        )}
        style={!selected ? { backgroundColor: 'var(--green-dark)' } : {}}
      >
        Todos
      </button>
      {categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.slug === selected ? null : cat.slug)}
          className={cn(
            'shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap',
            selected === cat.slug
              ? 'text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
          style={selected === cat.slug ? { backgroundColor: 'var(--green-dark)' } : {}}
        >
          {cat.emoji} {cat.name}
        </button>
      ))}
    </div>
  )
}
