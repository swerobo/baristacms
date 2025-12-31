import { useEffect, useState, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MsalProvider, useMsal } from '@azure/msal-react';
import { PublicClientApplication, EventType, InteractionStatus } from '@azure/msal-browser';
import type { AuthenticationResult, EventMessage } from '@azure/msal-browser';
import { fetchAuthConfig, createMsalConfig } from './config/authConfig';
import { UserProvider } from './context/UserContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { localAuthService } from './services/api';
import Layout from './components/Layout';
import LoginPage from './components/LoginPage';
import ChangePasswordPage from './components/ChangePasswordPage';
import Home from './pages/Home';
import Users from './pages/admin/Users';
import Settings from './pages/admin/Settings';
import Modules from './pages/admin/Modules';
import Menu from './pages/admin/Menu';
import Pages from './pages/admin/Pages';
import Dashboards from './pages/admin/Dashboards';
import BasicPages from './pages/admin/BasicPages';
import BasicPageEdit from './pages/admin/BasicPageEdit';
import Groups from './pages/admin/Groups';
import DashboardView from './pages/DashboardView';
import BasicPageView from './pages/BasicPageView';
import RecordsList from './pages/records/RecordsList';
import RecordEdit from './pages/records/RecordEdit';
import QuickAddForm from './pages/QuickAddForm';

// MSAL instance will be created dynamically after fetching config
let msalInstance: PublicClientApplication | null = null;

/**
 * Initialize MSAL with config from database or environment
 */
async function initializeMsal(): Promise<PublicClientApplication> {
  if (msalInstance) {
    return msalInstance;
  }

  // Fetch auth config from API (falls back to env vars)
  const authConfig = await fetchAuthConfig();
  console.log('Auth config loaded:', { tenantId: authConfig.tenantId, clientId: authConfig.clientId ? '***' : 'not set' });

  // Create MSAL config
  const config = createMsalConfig(authConfig.tenantId, authConfig.clientId);
  msalInstance = new PublicClientApplication(config);

  // Initialize MSAL
  await msalInstance.initialize();

  // Handle redirect promise
  try {
    const response = await msalInstance.handleRedirectPromise();
    if (response) {
      console.log('Login successful:', response);
      msalInstance.setActiveAccount(response.account);
    }
  } catch (error) {
    console.error('Redirect error:', error);
  }

  // Set active account if available
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    msalInstance.setActiveAccount(accounts[0]);
  }

  // Listen for sign-in events
  msalInstance.addEventCallback((event: EventMessage) => {
    console.log('MSAL Event:', event.eventType, event);
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
      const payload = event.payload as AuthenticationResult;
      msalInstance?.setActiveAccount(payload.account);
    }
  });

  return msalInstance;
}

// Public routes that don't require authentication
function PublicRoutes() {
  return (
    <Routes>
      <Route path="form/:slug" element={<QuickAddForm />} />
      <Route path="dashboard/:slug" element={<DashboardView />} />
      <Route path="page/:slug" element={<BasicPageView />} />
    </Routes>
  );
}

// Protected routes that require authentication
function ProtectedRoutes() {
  return (
    <UserProvider>
      <ThemeProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="admin/modules" element={<Modules />} />
              <Route path="admin/menu" element={<Menu />} />
              <Route path="admin/pages" element={<Pages />} />
              <Route path="admin/dashboards" element={<Dashboards />} />
              <Route path="admin/basic-pages" element={<BasicPages />} />
              <Route path="admin/basic-pages/:id" element={<BasicPageEdit />} />
              <Route path="admin/users" element={<Users />} />
              <Route path="admin/groups" element={<Groups />} />
              <Route path="admin/settings" element={<Settings />} />
              <Route path="records/:moduleName" element={<RecordsList />} />
              <Route path="records/:moduleName/:id" element={<RecordEdit />} />
              <Route path="dashboard/:slug" element={<DashboardView />} />
              <Route path="page/:slug" element={<BasicPageView />} />
            </Route>
            <Route path="form/:slug" element={<QuickAddForm />} />
          </Routes>
        </ToastProvider>
      </ThemeProvider>
    </UserProvider>
  );
}

// Main app content with auth check
function AppContent() {
  const { accounts, inProgress } = useMsal();
  const [localAuthValid, setLocalAuthValid] = useState<boolean | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check local auth on mount
  useEffect(() => {
    const checkLocalAuth = async () => {
      const token = localAuthService.getToken();
      if (token) {
        try {
          const result = await localAuthService.verifyToken(token);
          setLocalAuthValid(result.valid);
        } catch {
          localAuthService.removeToken();
          setLocalAuthValid(false);
        }
      } else {
        setLocalAuthValid(false);
      }
      setCheckingAuth(false);
    };

    checkLocalAuth();
  }, []);

  // Handle local login
  const handleLocalLogin = useCallback((token: string, changePassword: boolean) => {
    localAuthService.saveToken(token);
    setLocalAuthValid(true);
    setMustChangePassword(changePassword);
  }, []);

  // Handle local logout
  const handleLocalLogout = useCallback(() => {
    localAuthService.removeToken();
    setLocalAuthValid(false);
    setMustChangePassword(false);
  }, []);

  // Handle password changed
  const handlePasswordChanged = useCallback(() => {
    setMustChangePassword(false);
  }, []);

  // Log auth status
  useEffect(() => {
    console.log('Auth status - M365 accounts:', accounts.length, 'localAuth:', localAuthValid, 'inProgress:', inProgress);
  }, [accounts, localAuthValid, inProgress]);

  // Still checking auth
  if (checkingAuth || inProgress !== InteractionStatus.None) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Check if authenticated (either M365 or local)
  const isM365Authenticated = accounts.length > 0;
  const isLocalAuthenticated = localAuthValid === true;
  const isAuthenticated = isM365Authenticated || isLocalAuthenticated;

  // Check for public routes first
  const currentPath = window.location.pathname;
  const isPublicRoute = currentPath.startsWith('/form/') ||
    currentPath.startsWith('/dashboard/') ||
    currentPath.startsWith('/page/');

  if (isPublicRoute && !isAuthenticated) {
    return <PublicRoutes />;
  }

  // If authenticated with local and must change password
  if (isLocalAuthenticated && mustChangePassword) {
    return <ChangePasswordPage onPasswordChanged={handlePasswordChanged} onLogout={handleLocalLogout} />;
  }

  // Show login or protected routes
  if (!isAuthenticated) {
    return <LoginPage onLocalLogin={handleLocalLogin} />;
  }

  return <ProtectedRoutes />;
}

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [instance, setInstance] = useState<PublicClientApplication | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    initializeMsal()
      .then((msal) => {
        setInstance(msal);
        setIsInitialized(true);
        console.log('MSAL initialized with dynamic config');
      })
      .catch((error) => {
        console.error('Failed to initialize MSAL:', error);
        setInitError(error.message || 'Failed to initialize authentication');
      });
  }, []);

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-2">Authentication Error</div>
          <div className="text-gray-600 text-sm">{initError}</div>
        </div>
      </div>
    );
  }

  if (!isInitialized || !instance) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <MsalProvider instance={instance}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </MsalProvider>
  );
}

export default App;
