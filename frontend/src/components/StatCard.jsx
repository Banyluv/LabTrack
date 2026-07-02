import { useNavigate } from 'react-router-dom';

export default function StatCard({ label, value, sub, color = 'default', to }) {
  const navigate = useNavigate();
  const variants = {
    default: {
      label: 'text-slate-500 dark:text-slate-400',
      value: 'text-slate-900 dark:text-white',
      sub: 'text-slate-500 dark:text-slate-400',
      bg: 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/80',
    },
    green: {
      label: 'text-emerald-600 dark:text-emerald-300',
      value: 'text-slate-900 dark:text-white',
      sub: 'text-slate-500 dark:text-slate-400',
      bg: 'bg-emerald-50/70 dark:bg-emerald-950/70 border-emerald-200/80 dark:border-emerald-700/80',
    },
    amber: {
      label: 'text-amber-600 dark:text-amber-300',
      value: 'text-slate-900 dark:text-white',
      sub: 'text-slate-500 dark:text-slate-400',
      bg: 'bg-amber-50/80 dark:bg-amber-950/70 border-amber-200/80 dark:border-amber-700/80',
    },
    red: {
      label: 'text-rose-600 dark:text-rose-300',
      value: 'text-slate-900 dark:text-white',
      sub: 'text-slate-500 dark:text-slate-400',
      bg: 'bg-rose-50/80 dark:bg-rose-950/70 border-rose-200/80 dark:border-rose-700/80',
    },
  };
  const config = variants[color] || variants.default;

  return (
    <div
      className={`rounded-3xl border p-5 shadow-sm transition duration-200 ${config.bg} hover:shadow-lg ${to ? 'cursor-pointer hover:-translate-y-0.5' : 'cursor-default'}`}
      onClick={() => to && navigate(to)}
      title={to ? `View ${label}` : undefined}
    >
      <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${config.label}`}>{label}</p>
      <p className={`mt-4 text-3xl font-semibold leading-tight ${config.value}`}>{value}</p>
      {sub && <p className={`mt-3 text-sm leading-6 ${config.sub}`}>{sub}</p>}
    </div>
  );
}
