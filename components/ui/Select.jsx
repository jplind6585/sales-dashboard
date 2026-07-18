import { ChevronDown } from 'lucide-react';

// Branded select — replaces native OS <select> (beveled system chevron) which broke the custom-UI
// illusion (PLATFORM_REVIEW §5.9). Still a real <select> under the hood for accessibility, but
// appearance-none with a coral-focus ring and our own chevron.
export default function Select({ value, onChange, children, className = '', ...props }) {
  return (
    <div className={`relative inline-flex ${className}`}>
      <select
        value={value}
        onChange={onChange}
        className="appearance-none w-full text-sm text-ink bg-white border border-hairline rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-coral-200 focus:border-coral-400 cursor-pointer"
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}
