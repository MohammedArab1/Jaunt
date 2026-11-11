import { cn, initials } from '@/lib/utils'

interface AvatarProps {
  name: string
  color: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-xl',
}

export function Avatar({ name, color, size = 'md', className }: AvatarProps) {
  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full border border-white/20 font-display font-extrabold tracking-[-0.02em] text-ink shadow-inner',
        sizeClasses[size],
        className,
      )}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}
