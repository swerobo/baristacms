import { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { useUser } from '../context/UserContext';
import { menuService, settingsService, type MenuItem } from '../services/api';
import {
  HomeIcon,
  CubeIcon,
  ArrowRightOnRectangleIcon,
  BuildingOffice2Icon,
  Cog6ToothIcon,
  UsersIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
  ClipboardDocumentListIcon,
  Squares2X2Icon,
  ArchiveBoxIcon,
  DocumentTextIcon,
  DocumentPlusIcon,
  CalendarIcon,
  ChartBarIcon,
  FolderIcon,
  InboxIcon,
  TagIcon,
  Bars3Icon,
  XMarkIcon,
  UserGroupIcon,
  TruckIcon,
  BeakerIcon,
  WrenchIcon,
  ComputerDesktopIcon,
  PhoneIcon,
  MapPinIcon,
  ClockIcon,
  StarIcon,
  HeartIcon,
  BellIcon,
  BookOpenIcon,
  BriefcaseIcon,
  CameraIcon,
  ChatBubbleLeftIcon,
  CloudIcon,
  CurrencyDollarIcon,
  GlobeAltIcon,
  KeyIcon,
  LightBulbIcon,
  MusicalNoteIcon,
  PaperClipIcon,
  ShoppingCartIcon,
  TicketIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline';

// Map icon names to components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  HomeIcon,
  CubeIcon,
  BuildingOffice2Icon,
  Cog6ToothIcon,
  UsersIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
  WrenchIcon,
  ClipboardDocumentListIcon,
  Squares2X2Icon,
  ArchiveBoxIcon,
  DocumentTextIcon,
  DocumentPlusIcon,
  CalendarIcon,
  ClockIcon,
  ChartBarIcon,
  FolderIcon,
  InboxIcon,
  TagIcon,
  TruckIcon,
  BeakerIcon,
  ComputerDesktopIcon,
  PhoneIcon,
  MapPinIcon,
  StarIcon,
  HeartIcon,
  BellIcon,
  BookOpenIcon,
  BriefcaseIcon,
  CameraIcon,
  ChatBubbleLeftIcon,
  CloudIcon,
  CurrencyDollarIcon,
  GlobeAltIcon,
  KeyIcon,
  LightBulbIcon,
  MusicalNoteIcon,
  PaperClipIcon,
  ShoppingCartIcon,
  TicketIcon,
  VideoCameraIcon,
};

// Get icon component by name, with fallback
const getIcon = (iconName?: string): React.ComponentType<{ className?: string }> => {
  if (iconName && iconMap[iconName]) {
    return iconMap[iconName];
  }
  return CubeIcon; // Default icon
};

export default function Layout() {
  const { accounts } = useMsal();
  const { user, isAdmin, isManager, loading, photoUrl, logout } = useUser();
  const account = accounts[0];
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [siteName, setSiteName] = useState('BaristaCMS');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // Update browser tab title when site name changes
  useEffect(() => {
    document.title = siteName;
  }, [siteName]);

  // Close sidebar when route changes (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Load unread counts
  const loadUnreadCounts = useCallback(async () => {
    try {
      const counts = await menuService.getUnreadCounts();
      setUnreadCounts(counts);
    } catch (error) {
      console.error('Failed to load unread counts:', error);
    }
  }, []);

  // Load menu and settings from database (wait for user to be loaded first)
  useEffect(() => {
    if (!loading && user) {
      loadMenu();
      loadSettings();
      loadUnreadCounts();
    }
  }, [loading, user, loadUnreadCounts]);

  // Refresh unread counts periodically and when route changes
  useEffect(() => {
    loadUnreadCounts();
    const interval = setInterval(loadUnreadCounts, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [location.pathname, loadUnreadCounts]);

  const loadMenu = async () => {
    try {
      const items = await menuService.getTree();
      console.log('Menu items loaded:', JSON.stringify(items, null, 2));
      setMenuItems(items);
      // Auto-expand all top-level groups
      setExpandedGroups(items.map(item => item.name));
    } catch (error) {
      console.error('Failed to load menu:', error);
    } finally {
      setMenuLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const settings = await settingsService.getAll();
      if (settings.site_name?.value) {
        setSiteName(settings.site_name.value);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) =>
      prev.includes(groupName)
        ? prev.filter((name) => name !== groupName)
        : [...prev, groupName]
    );
  };

  const canSeeMenuItem = (item: MenuItem) => {
    if (!item.required_role) return true;
    if (item.required_role === 'admin') return isAdmin;
    if (item.required_role === 'manager') return isManager;
    return false;
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500';
      case 'manager':
        return 'bg-amber-500';
      default:
        return 'bg-slate-500';
    }
  };

  // Get unread count for a menu item (modules only)
  const getUnreadCount = (item: MenuItem): number => {
    if (item.is_module && item.name) {
      return unreadCounts[item.name] || 0;
    }
    return 0;
  };

  // Calculate total unread count for a group (sum of all module children)
  const getGroupUnreadCount = (group: MenuItem): number => {
    if (!group.children) return 0;
    return group.children.reduce((sum, child) => sum + getUnreadCount(child), 0);
  };

  // Separate top-level items (with path, no children) and groups (with children or no path)
  const topLevelItems = menuItems.filter(item => item.path && (!item.children || item.children.length === 0));
  const menuGroups = menuItems.filter(item => !item.path || (item.children && item.children.length > 0));

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-40 md:hidden" style={{ backgroundColor: 'var(--theme-sidebar-bg)' }}>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3 text-white">
            <BuildingOffice2Icon className="h-8 w-8" style={{ color: 'var(--theme-accent-light)' }} />
            <span className="text-xl font-bold">{siteName}</span>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-white rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Toggle menu"
          >
            {sidebarOpen ? (
              <XMarkIcon className="h-6 w-6" />
            ) : (
              <Bars3Icon className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-64 text-white flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          pt-16 md:pt-0
        `}
        style={{ backgroundColor: 'var(--theme-sidebar-bg)' }}
      >
        {/* Logo - hidden on mobile (shown in mobile header) */}
        <div className="hidden md:block p-4 border-b" style={{ borderColor: 'var(--theme-sidebar-border)' }}>
          <div className="flex items-center gap-3">
            <BuildingOffice2Icon className="h-8 w-8" style={{ color: 'var(--theme-accent-light)' }} />
            <span className="text-xl font-bold">{siteName}</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          {menuLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: 'var(--theme-accent-light)' }}></div>
            </div>
          ) : (
            <ul className="space-y-2">
              {/* Home link - always show */}
              <li>
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `nav-link ${isActive ? 'active' : ''}`
                  }
                >
                  <HomeIcon className="h-5 w-5" />
                  Home
                </NavLink>
              </li>

              {/* Top-level menu items with paths */}
              {topLevelItems.filter(canSeeMenuItem).map((item) => {
                const Icon = getIcon(item.icon || undefined);
                const unreadCount = getUnreadCount(item);
                return (
                  <li key={item.id}>
                    <NavLink
                      to={item.path!}
                      className={({ isActive }) =>
                        `nav-link ${isActive ? 'active' : ''}`
                      }
                    >
                      <Icon className="h-5 w-5" />
                      <span className="flex-1">{item.display_name}</span>
                      {unreadCount > 0 && (
                        <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium rounded-full bg-red-500 text-white">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </NavLink>
                  </li>
                );
              })}

              {/* Menu groups with sub-menus */}
              {menuGroups.filter(canSeeMenuItem).map((group) => {
                const GroupIcon = getIcon(group.icon || undefined);
                const hasChildren = group.children && group.children.length > 0;
                const groupUnreadCount = getGroupUnreadCount(group);

                return (
                  <li key={group.id}>
                    <button
                      onClick={() => toggleGroup(group.name)}
                      className="nav-group-btn"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <GroupIcon className="h-5 w-5" />
                        <span>{group.display_name}</span>
                        {groupUnreadCount > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium rounded-full bg-red-500 text-white">
                            {groupUnreadCount > 99 ? '99+' : groupUnreadCount}
                          </span>
                        )}
                      </div>
                      {hasChildren && (
                        expandedGroups.includes(group.name) ? (
                          <ChevronDownIcon className="h-4 w-4" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4" />
                        )
                      )}
                    </button>
                    {hasChildren && expandedGroups.includes(group.name) && (
                      <ul className="mt-1 ml-4 space-y-1">
                        {group.children!.filter(canSeeMenuItem).map((item) => {
                          const ItemIcon = getIcon(item.icon || undefined);
                          const itemUnreadCount = getUnreadCount(item);
                          return (
                            <li key={item.id}>
                              {item.path ? (
                                <NavLink
                                  to={item.path}
                                  onClick={() => console.log('Clicked menu item:', item.display_name, 'path:', item.path)}
                                  className={({ isActive }) =>
                                    `nav-link-sub ${isActive ? 'active' : ''}`
                                  }
                                >
                                  <ItemIcon className="h-4 w-4" />
                                  <span className="flex-1">{item.display_name}</span>
                                  {itemUnreadCount > 0 && (
                                    <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-4 px-1 text-xs font-medium rounded-full bg-red-500 text-white">
                                      {itemUnreadCount > 99 ? '99+' : itemUnreadCount}
                                    </span>
                                  )}
                                </NavLink>
                              ) : (
                                <span className="flex items-center gap-3 px-4 py-2 text-slate-500">
                                  <ItemIcon className="h-4 w-4" />
                                  {item.display_name}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        {/* User info */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--theme-sidebar-border)' }}>
          <div className="flex items-center gap-3 mb-3">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={user?.name || account?.name || 'User'}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style={{ backgroundColor: 'var(--theme-accent)' }}>
                {(user?.name || account?.name)?.charAt(0) || 'U'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || account?.name || 'User'}</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-400 truncate">{user?.email || account?.username || ''}</p>
                {!loading && user && (
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white ${getRoleBadgeColor(
                      user.role
                    )}`}
                  >
                    {user.role}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="sidebar-btn"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto pt-16 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
