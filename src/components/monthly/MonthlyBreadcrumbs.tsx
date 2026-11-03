import Link from 'next/link'
import { linkClass, mutedClass } from '@/components/ui/styles'

export interface BreadcrumbItem {
  href?: string
  label: string
}

export default function MonthlyBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="パンくず" className={`text-sm ${mutedClass}`}>
      <ol className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 list-none p-0">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {index > 0 && <span aria-hidden className="text-[#ccc]">/</span>}
              {item.href && !isLast ? (
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className={isLast ? 'text-ink' : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
