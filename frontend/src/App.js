import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/fonts.css';
import './styles/App.css';
// import UserLogin from './components/Login'; 
import UserLogin from'./components/auth/Login';
import UserRoutes from './routes/UserRoutes';
import AdminRoutes from './routes/AdminRoutes';
import AdminLogin from './admin/Login'; 

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<UserLogin />} />
            <Route path="/admin/login" element={
              <AdminLogin onLogin={() => window.location.href = '/admin/dashboard'} />
            } />
            
            {/* User Routes */}
            <Route path="/*" element={<UserRoutes />} />
            
            {/* Admin Routes */}
            <Route path="/admin/*" element={<AdminRoutes />} />
            
            {/* Redirects */}
            <Route path="/admin" element={<Navigate to="/admin/dashboard" />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;


// import React, { useState } from 'react';
// import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// import { AuthProvider, useAuth } from './contexts/AuthContext';
// import 'bootstrap/dist/css/bootstrap.min.css';
// import './styles/fonts.css';
// import History from './components/user/History';
// // --- USER IMPORTS ---
// import UserLogin from './components/auth/Login';
// import UserDashboard from './components/dashboard/Dashboard';
// import UserProfile from './components/user/Profile';
// import UserNavbar from './components/navigation/Navbar';
// import SupportTickets from './components/SupportTickets';
// import UserTicketDetail from './components/user/UserTicketDetail'; // <--- FIX 1: Import this
// import QuizManager from './admin/QuizManager';
// // --- ADMIN IMPORTS ---
// import AdminLogin from './admin/Login';
// import AdminDashboard from './admin/Dashboard';
// import AdminNavbar from './admin/Navigation';
// import AdminTickets from './admin/Tickets';
// import AdminTicketDetail from './admin/TicketDetail';
// import AdminUsers from './admin/Users';
// import AssignTickets from './admin/AssignTickets';
// import Employees from './admin/Employees';

// // Debug Auth Component
// // function DebugAuth() {
// //   const { user, loading } = useAuth();
// //   if (process.env.NODE_ENV !== 'development') return null;
// //   return (
// //     <div style={{ position: 'fixed', top: 10, right: 10, background: 'white', padding: '5px', zIndex: 9999, fontSize: '10px', border: '1px solid #ccc' }}>
// //       User: {loading ? '...' : (user ? user.email : 'None')}
// //     </div>
// //   );
// // }

// // User Protected Route
// function ProtectedUserRoute({ children }) {
//   const { user, loading } = useAuth();
//   if (loading) return <div className="text-center mt-5">Loading...</div>;
//   return user ? children : <Navigate to="/login" />;
// }

// // FIX 2: Wrapper to safely pass user prop
// function UserTicketRoute() {
//   const { user } = useAuth();
//   return <UserTicketDetail user={user} />;
// }

// // Admin Protected Route
// function ProtectedAdminRoute({ children, requiredRole }) {
//   let adminUser = null;
//   try {
//     const stored = localStorage.getItem('admin_user');
//     if (stored) adminUser = JSON.parse(stored);
//   } catch (e) {
//     localStorage.removeItem('admin_user');
//   }
  
//   if (!adminUser) {
//     return <Navigate to="/admin/login" replace />;
//   }
  
//   if (requiredRole && adminUser.role !== requiredRole) {
//     return <Navigate to="/admin/dashboard" replace />;
//   }

//   return children;
// }

// // Admin Layout Wrapper
// const AdminLayout = ({ children }) => {
//   const [adminUser] = useState(() => {
//     try {
//       return JSON.parse(localStorage.getItem('admin_user'));
//     } catch { return null; }
//   });

//   const logout = async () => {
//     try {
//       await fetch('/api/admin/logout', { 
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         credentials: 'include'
//       });
//     } catch (e) {
//       console.error("Logout failed", e);
//     } finally {
//       localStorage.removeItem('admin_user');
//       window.location.href = '/admin/login';
//     }
//   };

//   return (
//     <>
//       <AdminNavbar user={adminUser} onLogout={logout} />
//       <div className="container-fluid mt-3">
//         {children}
//       </div>
//     </>
//   );
// };

// function App() {
//   return (
//     <AuthProvider>
//       <Router>
//         <div className="App">
//           {/* <DebugAuth /> */}
//           <Routes>
//             {/* === USER ROUTES === */}
            
//             <Route path="/login" element={<UserLogin />} />
            
//             <Route path="/" element={
//                <ProtectedUserRoute><UserNavbar /><UserDashboard /></ProtectedUserRoute>
//             } />
            
//             <Route path="/dashboard" element={
//               <ProtectedUserRoute><UserNavbar /><UserDashboard /></ProtectedUserRoute>
//             } />
//             <Route path="/history" element={
//   <ProtectedUserRoute>
//     <UserNavbar />
//     <div className="container mt-4"><History /></div>
//   </ProtectedUserRoute>
// } />
//             <Route path="/profile" element={<ProtectedUserRoute><UserNavbar /><UserProfile /></ProtectedUserRoute>} />
//             <Route path="/support" element={
//               <ProtectedUserRoute>
//                 <UserNavbar />
//                 <div className="container mt-4"><SupportTickets /></div>
//               </ProtectedUserRoute>
//             } />

//             {/* FIX 3: Use the wrapper here */}
//             <Route path="/support/tickets/:id" element={
//               <ProtectedUserRoute>
//                  <UserNavbar />
//                  <UserTicketRoute />
//               </ProtectedUserRoute>
//             } />

//             {/* === ADMIN ROUTES === */}
//             <Route path="/admin/login" element={
//                 <AdminLogin onLogin={() => window.location.href = '/admin/dashboard'} />
//             } />

//             <Route path="/admin/dashboard" element={
//               <ProtectedAdminRoute>
//                 <AdminLayout>
//                   <AdminDashboard user={JSON.parse(localStorage.getItem('admin_user'))} />
//                 </AdminLayout>
//               </ProtectedAdminRoute>
//             } />
// <Route path="/quiz-manager" element={
//   <ProtectedAdminRoute requiredRole="admin">
//     <AdminLayout>
//       <QuizManager user={JSON.parse(localStorage.getItem('admin_user'))} />
//     </AdminLayout>
//   </ProtectedAdminRoute>
// } />
//             <Route path="/tickets" element={<ProtectedAdminRoute><AdminLayout><AdminTickets user={JSON.parse(localStorage.getItem('admin_user'))} /></AdminLayout></ProtectedAdminRoute>} />
//             <Route path="/tickets/:id" element={<ProtectedAdminRoute><AdminLayout><AdminTicketDetail user={JSON.parse(localStorage.getItem('admin_user'))} /></AdminLayout></ProtectedAdminRoute>} />
//             <Route path="/users" element={<ProtectedAdminRoute><AdminLayout><AdminUsers user={JSON.parse(localStorage.getItem('admin_user'))} /></AdminLayout></ProtectedAdminRoute>} />
//             <Route path="/assign" element={<ProtectedAdminRoute requiredRole="admin"><AdminLayout><AssignTickets /></AdminLayout></ProtectedAdminRoute>} />
//             <Route path="/employees" element={<ProtectedAdminRoute requiredRole="admin"><AdminLayout><Employees user={JSON.parse(localStorage.getItem('admin_user'))} /></AdminLayout></ProtectedAdminRoute>} />

//             {/* Catch All */}
//             <Route path="/admin" element={<Navigate to="/admin/dashboard" />} />
//             <Route path="*" element={<Navigate to="/dashboard" />} />
//           </Routes>
//         </div>
//       </Router>
//     </AuthProvider>
//   );
// }

// export default App;
