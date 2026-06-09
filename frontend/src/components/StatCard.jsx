import { useNavigate } from 'react-router-dom';

export default function StatCard({ label, value, sub, color = 'default', to }) {
  const navigate = useNavigate();
  const colors = {
    default: { text: 'text-slate-600 dark:text-slate-300', bg: 'from-slate-50 to-slate-100 dark:from-gray-800 dark:to-gray-700/80' },
    green: { text: 'text-green-600 dark:text-green-400', bg: 'from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-green-800/30' },
    amber: { text: 'text-amber-600 dark:text-amber-400', bg: 'from-amber-50 to-orange-100 dark:from-amber-900/30 dark:to-amber-800/30' },
    red: { text: 'text-red-500 dark:text-red-400', bg: 'from-red-50 to-pink-100 dark:from-red-900/30 dark:to-red-800/30' },
    teal: { text: 'text-teal-600 dark:text-teal-400', bg: 'from-teal-50 to-cyan-100 dark:from-teal-900/30 dark:to-teal-800/30' },
  };
  const colorConfig = colors[color];
  return (
    <div
      className={`card p-5 bg-gradient-to-br ${colorConfig.bg} border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg transition-all cursor-pointer`}
      onClick={() => to && navigate(to)}
      title={to ? `View ${label}` : ''}
    >
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colorConfig.text}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}
