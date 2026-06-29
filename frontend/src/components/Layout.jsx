import { useRef, useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )},
  { to: '/dashboard/inventory', label: 'Inventory', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
    </svg>
  )},
  { to: '/dashboard/request', label: 'Request Consumables', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
    </svg>
  )},
  { to: '/dashboard/dispatch', label: 'Dispatch Log', adminOnly: true, icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
    </svg>
  )},
  { to: '/dashboard/receive', label: 'Receive Stock', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
    </svg>
  )},
  { to: '/dashboard/reports', label: 'Reports', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
    </svg>
  )},
  { to: '/dashboard/quarterly-reports', label: 'Quarterly Reports', adminOnly: true, icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  )},
  { to: '/dashboard/facilities', label: 'Facilities', adminOnly: true, icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
    </svg>
  )},
  { to: '/dashboard/approve-requests', label: 'Approve Requests', adminOnly: true, icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
  )},
  { to: '/dashboard/settings', label: 'Settings', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
    </svg>
  )},
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [location]);

  // Close sidebar on Escape key
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') setSidebarOpen(false); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  // Filter nav items based on role
  const filteredNavItems = navItems.filter(item => 
    !item.adminOnly || user?.role === 'admin'
  );

  // Keyboard navigation - arrow keys to cycle through sidebar items
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!navRef.current) return;
      const items = navRef.current.querySelectorAll('a');
      if (items.length === 0) return;
      const current = document.activeElement;
      const currentIdx = Array.from(items).indexOf(current);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIdx = currentIdx >= items.length - 1 ? 0 : currentIdx + 1;
        items[nextIdx].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIdx = currentIdx <= 0 ? items.length - 1 : currentIdx - 1;
        items[prevIdx].focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const sidebarContent = (
    <>
      <div className="px-5 py-5 border-b border-green-500 dark:border-green-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-green-700 dark:bg-green-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-white">ECEWS Consumable Tracker</p>
              <p className="text-xs text-green-100 dark:text-green-200">Inventory Management</p>
            </div>
          </div>
          {/* Close button - mobile only */}
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-green-200 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <nav ref={navRef} className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-2 text-xs font-bold text-green-200 dark:text-green-300 uppercase tracking-wider mb-2">Main</p>
        {filteredNavItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/dashboard'} className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-green-300 focus-visible:ring-offset-1 focus-visible:ring-offset-green-800 font-semibold ${
              isActive
                ? 'bg-green-800 dark:bg-green-950 text-white font-bold shadow-md'
                : 'text-white hover:bg-green-700 dark:hover:bg-green-700'
            }`
          }>
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-green-500 dark:border-green-700">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-300">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs text-green-100 dark:text-green-200 capitalize">{user?.role}</p>
          </div>
          <button onClick={toggleTheme} className="text-green-200 dark:text-green-300 hover:text-white dark:hover:text-white transition-colors mr-0.5" title={dark ? 'Light mode' : 'Dark mode'}>
            {dark ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              </svg>
            )}
          </button>
          <button onClick={handleLogout} className="text-green-200 dark:text-green-300 hover:text-white dark:hover:text-white transition-colors" title="Logout">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 overflow-hidden">
      {/* Desktop Sidebar - hidden on mobile */}
      <aside className="hidden lg:flex lg:flex-col w-56 bg-green-600 dark:bg-green-800 border-r border-green-500 dark:border-green-700 flex-shrink-0 shadow-lg">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
          <aside className="lg:hidden fixed inset-y-0 left-0 w-64 bg-green-600 dark:bg-green-800 flex flex-col z-50 shadow-2xl animate-slide-in">
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        {/* Mobile Top Bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-green-600 dark:bg-green-800 text-white sticky top-0 z-30 shadow-md">
          <button onClick={() => setSidebarOpen(true)} className="p-1 hover:bg-green-700 dark:hover:bg-green-700 rounded">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <span className="text-sm font-bold truncate">ECEWS Consumable Tracker</span>
        </div>

        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
