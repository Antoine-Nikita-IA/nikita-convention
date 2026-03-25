import { useState, useEffect, useMemo } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { LayoutDashboard, FileText, GraduationCap, Users, Settings, Menu, X, LogOut, UserCog, Moon, Sun } from 'lucide-react';
import { ROLE_LABELS } from '@/types/database';
import { dataService } from '@/lib/services';
import { useTheme } from '@/hooks/useTheme';

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  roles?: string[]; // undefined = visible par tous
  badgeKey?: string;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/sessions', icon: FileText, label: 'Sessions' },
  { to: '/formations', icon: GraduationCap, label: 'Formations', roles: ['admin'] },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/utilisateurs', icon: UserCog, label: 'Utilisateurs', roles: ['admin'], badgeKey: 'pendingUsers' },
  { to: '/settings', icon: Settings, label: 'Paramètres', roles: ['admin'] },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [pendingUsersCount, setPendingUsersCount] = useState(0);

  const navItems = useMemo(() => {
    const role = user?.role || 'user';
    return ALL_NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
  }, [user?.role]);

  // Load pending users count for admin badge
  useEffect(() => {
    if (user?.role !== 'admin') return;
    dataService.getUsers().then((users) => {
      setPendingUsersCount(users.filter((u) => !u.is_validated).length);
    }).catch(() => {});
  }, [user?.role]);

  const badges: Record<string, number> = {
    pendingUsers: pendingUsersCount,
  };

  function handleLogout() { logout(); navigate('/login'); }

  return (
    <div className="min-h-screen flex">
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-40 w-64 bg-nikita-dark text-white flex flex-col transition-transform lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <div className="w-9 h-9 bg-nikita-pink rounded-lg flex items-center justify-center font-bold text-lg">N</div>
          <div>
            <div className="font-semibold text-sm">NIKITA</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">Convention</div>
          </div>
          <button className="lg:hidden ml-auto p-1" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label, badgeKey }) => {
            const badgeCount = badgeKey ? badges[badgeKey] || 0 : 0;
            return (
              <NavLink key={to} to={to} end={to === '/'} onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  isActive ? 'bg-nikita-pink/20 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon size={18} />
                <span className="flex-1">{label}</span>
                {badgeCount > 0 && (
                  <span className="min-w-[20px] h-5 flex items-center justify-center px-1.5 text-[10px] font-bold bg-yellow-500 text-white rounded-full">
                    {badgeCount}
                  </span>
                )}
              </NavLink>
            );
          })}
          <div className="pt-4 mt-4 border-t border-white/10">
            <button onClick={toggleTheme} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors w-full">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              <span>{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</span>
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <button onClick={() => { navigate('/profil'); setSidebarOpen(false); }} className="w-8 h-8 rounded-full bg-nikita-pink/30 flex items-center justify-center text-xs font-medium hover:bg-nikita-pink/50 transition-colors" title="Mon profil">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </button>
            <button onClick={() => { navigate('/profil'); setSidebarOpen(false); }} className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity" title="Mon profil">
              <div className="text-sm font-medium truncate">{user?.first_name} {user?.last_name}</div>
              <div className="text-[10px] text-gray-400 truncate">{user?.role ? ROLE_LABELS[user.role] : user?.email}</div>
            </button>
            <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="Déconnexion">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-h-screen">
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100"><Menu size={20} /></button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-nikita-pink rounded-lg flex items-center justify-center font-bold text-white text-sm">N</div>
            <span className="font-semibold text-sm">NIKITA Convention</span>
          </div>
          <div className="w-9" />
        </div>
        <div className="p-6 lg:p-8 max-w-7xl mx-auto"><Outlet /></div>
      </main>
    </div>
  );
}
