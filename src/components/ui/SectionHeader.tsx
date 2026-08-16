interface SectionHeaderProps {
  title: string
  description?: string
}

export default function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="grid gap-2">
      <h2 className="m-0 text-[22px] font-semibold text-ink">{title}</h2>
      {description && <p className="m-0 text-sm text-muted">{description}</p>}
    </div>
  )
}
