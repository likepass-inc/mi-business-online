import { ReactNode } from 'react'

interface StatGridProps {
  children: ReactNode
  columns?: 2 | 3 | 4
}

const columnClass = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
}

export function StatGrid({ children, columns = 4 }: StatGridProps) {
  return (
    <div className={`grid grid-cols-1 ${columnClass[columns]} border-y border-line`}>
      {children}
    </div>
  )
}

interface StatProps {
  label: string
  value: ReactNode
  meta?: ReactNode
}

export function Stat({ label, value, meta }: StatProps) {
  return (
    <div className="grid gap-2 content-start py-5 pr-4 sm:pl-4 sm:border-l sm:border-line sm:[&:nth-child(2n+1)]:pl-0 sm:[&:nth-child(2n+1)]:border-l-0 lg:[&:nth-child(4n+1)]:pl-0 lg:[&:nth-child(4n+1)]:border-l-0 lg:[&:nth-child(n+5)]:border-t">
      <p className="m-0 text-[13px] text-muted">{label}</p>
      <p className="m-0 text-[28px] font-semibold leading-tight text-ink">{value}</p>
      {meta}
    </div>
  )
}
