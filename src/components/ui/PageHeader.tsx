import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  children?: ReactNode
}

export default function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="grid gap-3">
      <h1 className="m-0 text-[22px] font-semibold text-ink">{title}</h1>
      {description && <p className="m-0 text-sm text-muted">{description}</p>}
      {children}
    </div>
  )
}
