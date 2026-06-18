import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import HostelDetailPage from "./pages/HostelDetailPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import StudentDashboard from "./pages/StudentDashboard.jsx";
import ManagerPortal from "./pages/ManagerPortal.jsx";
import NewHostelPage from "./pages/NewHostelPage.jsx";
import ManagerVerificationPage from "./pages/ManagerVerificationPage.jsx";
import ManagerVerificationCallback from "./pages/ManagerVerificationCallback.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import { NotificationProvider } from "./context/NotificationContext.jsx";
import { ChatProvider } from "./context/ChatContext.jsx";
import ChatPage from "./pages/ChatPage.jsx";

export default function App() {
  return (
    <NotificationProvider>
    <ChatProvider>
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/hostels/:slug" element={<HostelDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute role="student">
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/:tab"
            element={
              <ProtectedRoute role="student">
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/new-hostel"
            element={
              <ProtectedRoute role="manager">
                <NewHostelPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/verification/callback"
            element={
              <ProtectedRoute role="manager">
                <ManagerVerificationCallback />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/verification"
            element={
              <ProtectedRoute role="manager">
                <ManagerVerificationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager"
            element={
              <ProtectedRoute role="manager">
                <ManagerPortal />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/:tab"
            element={
              <ProtectedRoute role="manager">
                <ManagerPortal />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute role="superadmin">
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute role="student">
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat/:groupId"
            element={
              <ProtectedRoute role="student">
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
    </ChatProvider>
    </NotificationProvider>
  );
}
