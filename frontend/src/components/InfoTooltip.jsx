import { useState } from 'react';

export default function InfoTooltip({ text, placement = 'top' }) {
  const [visible, setVisible] = useState(false);

  const placements = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span
      className="relative inline-flex items-center cursor-help group"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={() => setVisible(v => !v)}
    >
      {/* Info icon */}
      <svg
        className="w-4 h-4 text-blue-400 hover:text-blue-500 dark:text-blue-300 dark:hover:text-blue-200 transition-colors shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
      </svg>

      {/* Tooltip */}
      {visible && (
        <div
          className={`absolute z-[100] ${placements[placement] || placements.top} w-64`}
        >
          <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs leading-relaxed px-3 py-2 rounded-lg shadow-xl border border-gray-700 dark:border-gray-600">
            {text}
          </div>
        </div>
      )}
    </span>
  );
}
