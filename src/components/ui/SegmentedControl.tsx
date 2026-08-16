interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div className="flex" role="group" aria-label={ariaLabel}>
      {options.map((option, index) => {
        const selected = option.value === value
        const isFirst = index === 0
        const isLast = index === options.length - 1
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={[
              'px-4 py-2.5 text-sm border border-[#ccc] -ml-px first:ml-0',
              isFirst ? 'rounded-l-admin' : '',
              isLast ? 'rounded-r-admin' : '',
              selected
                ? 'relative z-[1] bg-ink text-white border-ink hover:bg-ink hover:text-white'
                : 'bg-white text-ink hover:bg-[#f5f5f5] hover:text-ink',
            ].join(' ')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
