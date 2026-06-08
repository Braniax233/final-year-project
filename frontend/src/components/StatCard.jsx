const PALETTE = {
  blue:   { wrap: 'bg-white',        icon: 'bg-blue-100   text-blue-600',   val: 'text-blue-700',   sub: 'text-blue-400',  bar: 'bg-blue-500'   },
  green:  { wrap: 'bg-white',        icon: 'bg-green-100  text-green-600',  val: 'text-green-700',  sub: 'text-green-400', bar: 'bg-green-500'  },
  amber:  { wrap: 'bg-white',        icon: 'bg-amber-100  text-amber-600',  val: 'text-amber-700',  sub: 'text-amber-400', bar: 'bg-amber-500'  },
  red:    { wrap: 'bg-white',        icon: 'bg-red-100    text-red-600',    val: 'text-red-700',    sub: 'text-red-400',   bar: 'bg-red-500'    },
  purple: { wrap: 'bg-white',        icon: 'bg-purple-100 text-purple-600', val: 'text-purple-700', sub: 'text-purple-400',bar: 'bg-purple-500' },
};

/**
 * StatCard
 * @param {string}         title    - Card label
 * @param {string|number}  value    - Primary metric
 * @param {string}         subtitle - Helper text below value
 * @param {React.Component} icon    - lucide-react icon component
 * @param {string}         color    - 'blue' | 'green' | 'amber' | 'red' | 'purple'
 * @param {string}         trend    - Optional trend label (e.g. '+5% this week')
 */
export default function StatCard({ title, value, subtitle, icon: Icon, color = 'blue', trend }) {
  const p = PALETTE[color] || PALETTE.blue;

  return (
    <div className={`${p.wrap} rounded-xl border border-gray-100 shadow-sm overflow-hidden`}>
      {/* Colored top bar */}
      <div className={`h-1 ${p.bar}`} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          {Icon && (
            <div className={`p-2 rounded-lg ${p.icon}`}>
              <Icon size={18} />
            </div>
          )}
        </div>

        <p className={`text-3xl font-bold ${p.val}`}>{value ?? '—'}</p>

        {subtitle && (
          <p className={`text-xs mt-1 ${p.sub}`}>{subtitle}</p>
        )}

        {trend && (
          <p className="text-xs text-gray-400 mt-2">{trend}</p>
        )}
      </div>
    </div>
  );
}
