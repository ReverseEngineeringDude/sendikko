import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth.store.ts';
import { useThemeStore } from './stores/theme.store.ts';
import { Navbar } from './components/Navbar.tsx';
import { Footer } from './components/Footer.tsx';
import { UploadModal } from './components/UploadModal.tsx';
import { ShareResultModal } from './components/ShareResultModal.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { DownloadPage } from './pages/DownloadPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { RequestFilesPage } from './pages/RequestFilesPage.tsx';
import { VideoWatchPage } from './pages/VideoWatchPage.tsx';

export function App() {
  const { checkSession, isAuthenticated, isLoading } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const isEmbed = typeof window !== 'undefined' && window.location.pathname.includes('/embed');

  useEffect(() => {
    setTheme(theme);
    checkSession();
  }, [checkSession, setTheme, theme]);

  if (isEmbed) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/v/:code/embed" element={<VideoWatchPage isEmbed />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
        <Navbar />

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/d/:code" element={<DownloadPage />} />
            <Route path="/v/:code" element={<VideoWatchPage />} />
            <Route path="/v/:code/embed" element={<VideoWatchPage isEmbed />} />
            <Route
              path="/dashboard"
              element={
                isLoading ? (
                  <div className="py-24 text-center text-sm text-slate-400">Loading vault...</div>
                ) : isAuthenticated ? (
                  <DashboardPage />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route path="/request/:userId" element={<RequestFilesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <Footer />

        {/* Global Modals */}
        <UploadModal />
        <ShareResultModal />
      </div>
    </BrowserRouter>
  );
}

export default App;
