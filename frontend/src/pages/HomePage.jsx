import { useNavigate } from 'react-router-dom';

const features = [
  {
    title: 'Inventory Tracking',
    desc: 'Real-time monitoring of laboratory consumables with low-stock alerts and automated reorder thresholds.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    title: 'Dispatch & Receive',
    desc: 'Track item dispatch logs and incoming stock receipts. Full audit trail with timestamps and personnel records.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    title: 'Request Management',
    desc: 'Staff can submit consumable requests for approval. Admins review, approve or reject with full visibility.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    title: 'Quarterly Reports',
    desc: 'Generate detailed quarterly consumption reports. Upload Excel data for automated analytics and trend tracking.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    title: 'Category Organization',
    desc: 'Consumables organized by laboratory departments — Hematology, Chemistry, Microbiology, Immunology and more.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    title: 'Smart Alerts',
    desc: 'Automatic low-stock notifications. Never run out of critical supplies with proactive replenishment warnings.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
];

const stats = [
  { value: '10+', label: 'Departments' },
  { value: '45+', label: 'Stock Items' },
  { value: 'Real-time', label: 'Tracking' },
  { value: '24/7', label: 'Availability' },
];

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-emerald-900/95 backdrop-blur-md border-b border-emerald-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center shadow-md">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div className="leading-tight">
                <span className="text-lg font-black text-white tracking-tight">ECEWS</span>
                <p className="text-[10px] text-emerald-300 font-bold leading-tight">Logistics Consumable Management System</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 text-sm font-medium text-emerald-200 hover:text-white transition-colors"
              >
                Sign in
              </button>
              <button
                onClick={() => navigate('/register')}
                className="px-4 py-2 text-sm font-medium text-emerald-900 bg-white rounded-lg hover:bg-gray-100 shadow-md hover:shadow-lg transition-all"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-gradient-to-br from-emerald-400 via-emerald-200 to-emerald-400 opacity-20 blur-3xl" />
          <div className="absolute top-40 right-0 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-emerald-300 to-emerald-200 opacity-15 blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-800 border border-emerald-700 rounded-full text-xs font-medium text-white mb-6">
              <span className="w-1.5 h-1.5 bg-white rounded-full" />
              Laboratory Inventory Management
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-emerald-900 tracking-tight leading-tight">
              Manage your lab
              <span className="block bg-gradient-to-r from-emerald-800 to-emerald-700 bg-clip-text text-transparent">
                with confidence
              </span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-emerald-800 leading-relaxed max-w-2xl mx-auto">
              A complete laboratory consumables management system. Track inventory, manage requests, 
              monitor stock levels, and generate reports — all in one place.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate('/register')}
                className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-white bg-gradient-to-r from-emerald-800 to-emerald-700 rounded-xl hover:from-emerald-900 hover:to-emerald-800 shadow-lg hover:shadow-xl transition-all"
              >
                Start Free Account
              </button>
              <button
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 shadow-md hover:shadow-lg transition-all"
              >
                Sign In to Dashboard
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-12 border-y border-emerald-700 bg-emerald-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl sm:text-4xl font-bold text-white">{stat.value}</p>
                <p className="mt-1 text-sm text-emerald-200">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 sm:py-28 bg-emerald-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-emerald-900 tracking-tight">
              Everything you need to run your lab
            </h2>
            <p className="mt-4 text-lg text-emerald-800">
              From tracking stock levels to generating quarterly reports — the ECEWS Consumables & Logistics Management System simplifies
              consumables management across all departments.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative p-6 bg-emerald-800 rounded-2xl border border-emerald-700 hover:border-emerald-600 hover:shadow-xl transition-all duration-300"
              >
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-emerald-200 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Ready to streamline your lab operations?
          </h2>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
            Join laboratories already using ECEWS Logistics Consumable Management System to manage their consumables inventory efficiently.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/register')}
              className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-white bg-gradient-to-r from-emerald-800 to-emerald-700 rounded-xl hover:from-emerald-900 hover:to-emerald-800 shadow-lg hover:shadow-xl transition-all"
            >
              Create Your Account
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-slate-300 border border-slate-600 rounded-xl hover:bg-slate-800 hover:border-slate-500 transition-all"
            >
              Login to Dashboard
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-emerald-700 bg-emerald-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <span className="text-sm font-black text-white">ECEWS</span>
              <p className="text-xs text-emerald-300 font-bold">Consumables & Logistics Management System</p>
            </div>
            <p className="text-xs text-emerald-300">
              &copy; {new Date().getFullYear()} ECEWS Consumables & Logistics Management System
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}