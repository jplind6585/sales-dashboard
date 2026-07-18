// Standard neutral empty state (PLATFORM_REVIEW §3.9 / §5.2). Modeled on the Pursuit pattern
// the visual audit called the best: icon + headline + one line + a single CTA. Never an error
// icon for a neutral prompt.
export default function EmptyState({ icon: Icon, title, subtitle, action, className = '' }) {
  return (
    <div className={`bg-white rounded-card border border-hairline p-10 text-center flex flex-col items-center ${className}`}>
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-coral-50 flex items-center justify-center mb-3">
          <Icon className="w-6 h-6 text-coral-500" />
        </div>
      )}
      {title && <p className="text-base font-semibold text-ink">{title}</p>}
      {subtitle && <p className="text-sm text-slate-500 mt-1 max-w-md">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
