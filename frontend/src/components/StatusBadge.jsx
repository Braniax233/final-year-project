const STYLES = {
  NORMAL:   'bg-green-100  text-green-700  border-green-200',
  WARNING:  'bg-amber-100  text-amber-700  border-amber-200',
  CRITICAL: 'bg-red-100    text-red-700    border-red-200',
  RESOLVED: 'bg-gray-100   text-gray-600   border-gray-200',
  UNKNOWN:  'bg-gray-100   text-gray-500   border-gray-200',
};

const DOTS = {
  NORMAL:   'bg-green-500',
  WARNING:  'bg-amber-500',
  CRITICAL: 'bg-red-500',
  RESOLVED: 'bg-gray-400',
  UNKNOWN:  'bg-gray-400',
};

const LABELS = {
  NORMAL:   'Normal',
  WARNING:  'Warning',
  CRITICAL: 'Critical',
  RESOLVED: 'Resolved',
  UNKNOWN:  'Unknown',
};

/**
 * StatusBadge
 * @param {string}  status   - 'NORMAL' | 'WARNING' | 'CRITICAL' | 'RESOLVED'
 * @param {boolean} showDot  - Whether to show the colored dot (default true)
 * @param {string}  size     - 'sm' | 'md' (default 'sm')
 */
export default function StatusBadge({ status = 'NORMAL', showDot = true, size = 'sm' }) {
  const key = (status || 'UNKNOWN').toUpperCase();
  const styleKey = STYLES[key] ? key : 'UNKNOWN';
  const padding = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${padding} ${STYLES[styleKey]}`}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOTS[styleKey]}`} />
      )}
      {LABELS[styleKey] || key}
    </span>
  );
}
