/**
 * LoadingSpinner – full-viewport centered spinner.
 * @param {string} size    - 'sm' | 'md' | 'lg' (default 'lg')
 * @param {string} message - Optional text beneath the spinner
 */
export default function LoadingSpinner({ size = 'lg', message }) {
  const dim = size === 'sm' ? 'h-6 w-6 border-2' : size === 'md' ? 'h-9 w-9 border-[3px]' : 'h-12 w-12 border-4';
  const wrapper = size === 'lg' ? 'min-h-screen' : 'min-h-[120px]';

  return (
    <div className={`flex flex-col items-center justify-center ${wrapper} gap-3`}>
      <div
        className={`animate-spin rounded-full ${dim} border-blue-200 border-t-blue-600`}
        role="status"
        aria-label="Loading"
      />
      {message && <p className="text-sm text-gray-500">{message}</p>}
    </div>
  );
}
