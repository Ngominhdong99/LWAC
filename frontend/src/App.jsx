import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './components/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PracticeList from './pages/PracticeList';
import ReadingTest from './pages/ReadingTest';
import WritingTest from './pages/WritingTest';
import ListeningTest from './pages/ListeningTest';
import VocabVault from './pages/Vocab';
import Hub from './pages/Hub';
import CoachDashboard from './pages/CoachDashboard';
import StudentManager from './pages/StudentManager';
import CoachChat from './pages/CoachChat';
import TeacherQuestions from './pages/TeacherQuestions';
import LessonBuilder from './pages/LessonBuilder';
import SpeakingTest from './pages/SpeakingTest';
import LessonManager from './pages/LessonManager';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>;
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" />;
  return children;
};

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="p-8 flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'coach' ? '/coach' : '/'} /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        {/* Student Routes */}
        <Route index element={<Dashboard />} />
        <Route path="reading" element={<PracticeList />} />
        <Route path="reading/:id" element={<ReadingTest />} />
        <Route path="writing/:id" element={<WritingTest />} />
        <Route path="listening/:id" element={<ListeningTest />} />
        <Route path="speaking/:id" element={<SpeakingTest />} />
        <Route path="hub" element={<Hub />} />
        <Route path="vocab" element={<VocabVault />} />

        {/* Coach Routes */}
        <Route path="coach" element={<ProtectedRoute allowedRoles={['coach']}><CoachDashboard /></ProtectedRoute>} />
        <Route path="coach/students" element={<ProtectedRoute allowedRoles={['coach']}><StudentManager /></ProtectedRoute>} />
        <Route path="coach/chat" element={<ProtectedRoute allowedRoles={['coach']}><CoachChat /></ProtectedRoute>} />
        <Route path="coach/chat/:studentId" element={<ProtectedRoute allowedRoles={['coach']}><CoachChat /></ProtectedRoute>} />
        <Route path="coach/questions" element={<ProtectedRoute allowedRoles={['coach']}><TeacherQuestions /></ProtectedRoute>} />
        <Route path="coach/builder" element={<ProtectedRoute allowedRoles={['coach']}><LessonBuilder /></ProtectedRoute>} />
        <Route path="coach/builder/:id" element={<ProtectedRoute allowedRoles={['coach']}><LessonBuilder /></ProtectedRoute>} />
        <Route path="coach/lessons" element={<ProtectedRoute allowedRoles={['coach']}><LessonManager /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
