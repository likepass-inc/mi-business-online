import { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
}

export default function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center px-4 py-2.5 text-sm whitespace-nowrap cursor-pointer rounded-admin border-0 disabled:opacity-50 disabled:cursor-not-allowed'
  const styles =
    variant === 'secondary'
      ? 'bg-white text-ink border border-[#ccc] hover:bg-[#f5f5f5] hover:text-ink'
      : 'bg-accent text-white hover:bg-accent-hover'

  return <button type={type} className={`${base} ${styles} ${className}`} {...props} />
}

export function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Button variant="primary" {...props} />
}

export function SecondaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Button variant="secondary" {...props} />
}
