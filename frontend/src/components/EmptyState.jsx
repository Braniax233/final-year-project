/**
 * EmptyState – centred empty placeholder with icon, title, description.
 * @param {React.Component} icon        - lucide-react icon component
 * @param {string}          title       - Bold heading
 * @param {string}          description - Subtext
 * @param {React.ReactNode} action      - Optional CTA button/link
 */
export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      {Icon && (
        <div className="p-4 bg-gray-100 rounded-full mb-4 inline-flex">
          <Icon size={32} className="text-gray-400" />
        </div>
      )}

      {title && (
        <h3 className="text-base font-semibold text-gray-700 mb-1">{title}</h3>
      )}

      {description && (
        <p className="text-sm text-gray-500 max-w-xs leading-relaxed">{description}</p>
      )}

      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
