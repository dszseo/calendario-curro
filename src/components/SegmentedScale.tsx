interface Option<T> {
  value: T
  label: string
}

export function SegmentedScale<T extends string>({
  options,
  value,
  onChange,
  allowClear = false,
}: {
  options: readonly Option<T>[]
  value: T | undefined
  onChange: (v: T | undefined) => void
  allowClear?: boolean
}) {
  return (
    <div class="seg">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(allowClear && value === o.value ? undefined : o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function YesNo({
  value,
  onChange,
}: {
  value: boolean | undefined
  onChange: (v: boolean | undefined) => void
}) {
  return (
    <div class="seg">
      <button type="button" aria-pressed={value === true} onClick={() => onChange(value === true ? undefined : true)}>
        Sí
      </button>
      <button type="button" aria-pressed={value === false} onClick={() => onChange(value === false ? undefined : false)}>
        No
      </button>
    </div>
  )
}
