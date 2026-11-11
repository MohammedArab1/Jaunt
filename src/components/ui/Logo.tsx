import { cn } from '@/lib/utils'

export function LogoMark({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <img
      src="/logo.svg"
      alt=""
      width={size}
      height={size}
      className={cn('shrink-0 rounded-[28%] shadow-lg shadow-black/30', className)}
      style={{ width: size, height: size }}
    />
  )
}

export function Wordmark({ className, markSize = 30 }: { className?: string; markSize?: number }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark size={markSize} />
      <span className="font-display text-[22px] font-extrabold leading-none tracking-[-0.055em] text-cream">
        jaunt<span className="text-coral">.</span>
      </span>
    </span>
  )
}
