export function Button({ children, variant = 'primary', className = '', ...rest }) {
  const base = 'inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed'
  const styles = {
    primary: 'bg-ink text-ivory hover:bg-ink-soft',
    accent:  'bg-acid text-ink hover:bg-acid-deep btn-glow',
    ghost:   'bg-transparent text-ink hover:bg-ink/5 border border-ink/10',
    outline: 'border border-ink text-ink hover:bg-ink hover:text-ivory',
    danger:  'bg-red-600 text-white hover:bg-red-700',
    ig:      'ig-gradient text-white hover:opacity-90',
    fb:      'bg-fb-blue text-white hover:bg-blue-700',
    yt:      'bg-yt-red text-white hover:bg-red-700'
  }
  return <button className={`${base} ${styles[variant]} ${className}`} {...rest}>{children}</button>
}

export function Input({ className = '', ...rest }) {
  return <input className={`w-full px-4 py-3 bg-ivory-soft border border-ink/10 rounded-lg text-sm placeholder:text-mute-soft focus:outline-none focus:border-ink/40 focus:bg-white transition ${className}`} {...rest} />
}

export function Textarea({ className = '', ...rest }) {
  return <textarea className={`w-full px-4 py-3 bg-ivory-soft border border-ink/10 rounded-lg text-sm placeholder:text-mute-soft focus:outline-none focus:border-ink/40 focus:bg-white transition font-mono leading-relaxed ${className}`} {...rest} />
}

export function Card({ children, className = '' }) {
  return <div className={`bg-ivory-soft border border-ink/10 rounded-2xl ${className}`}>{children}</div>
}

export function PageHeader({ kicker, title, subtitle, right, className = '' }) {
  return (
    <div className={`px-10 pt-10 pb-6 border-b hairline ${className}`}>
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="space-y-2">
          {kicker && <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-mute">{kicker}</div>}
          <h1 className="font-display text-5xl md:text-6xl tracking-tightest leading-[0.95]">{title}</h1>
          {subtitle && <div className="text-sm text-mute max-w-xl">{subtitle}</div>}
        </div>
        {right}
      </div>
    </div>
  )
}

export function Empty({ title, hint }) {
  return (
    <div className="text-center py-24">
      <div className="font-display italic text-2xl text-ink/70">{title}</div>
      {hint && <div className="text-sm mt-2 text-mute">{hint}</div>}
    </div>
  )
}

export function Spinner({ className = '' }) {
  return <div className={`inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ${className}`} />
}

export function Kicker({ children, className = '' }) {
  return <div className={`font-mono text-[11px] tracking-[0.22em] uppercase text-mute ${className}`}>{children}</div>
}

export function Tag({ children, tone = 'default' }) {
  const map = {
    default: 'bg-ink text-ivory',
    acid: 'bg-acid text-ink',
    outline: 'border border-ink/20 text-ink'
  }
  return <span className={`font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded-full ${map[tone]}`}>{children}</span>
}
