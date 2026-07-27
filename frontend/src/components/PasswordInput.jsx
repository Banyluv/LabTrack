import { useState } from 'react';

// Password field with a show/hide toggle. Accepts the same props as a plain
// <input>; className styles the input itself, just like the fields it replaces.
export default function PasswordInput({ className = 'input', ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`${className} pr-10`} />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-white focus:outline-none"
        title={visible ? 'Hide password' : 'Show password'}
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M3 3l18 18M10.584 10.587a2 2 0 002.828 2.83" />
            <path d="M9.363 5.365A9.466 9.466 0 0112 5c4.638 0 8.573 3.007 9.963 7.178a1 1 0 010 .644 10.02 10.02 0 01-4.132 5.411M6.228 6.228A10.02 10.02 0 002.037 11.822a1 1 0 000 .644C3.427 16.637 7.362 19 12 19a9.5 9.5 0 005.772-1.228" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M2.037 12.322a1 1 0 010-.644C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178a1 1 0 010 .644C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
