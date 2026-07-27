// Small in-tab segmented control used to merge former top-level tabs under one (Phase 2: 10 tabs -> 4).
export default function SubToggle({ value, onChange, options }) {
  return (
    <div className="flex items-center gap-1 px-4 pt-3">
      <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`text-xs font-medium px-3 py-1 rounded-md transition-colors ${
              value === o.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
