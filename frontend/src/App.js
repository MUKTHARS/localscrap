
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import Navbar from './components/Navbar';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Navbar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<Dashboard />} /> {/* Redirect login to dashboard */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;




// import React from 'react';
// import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// import { AuthProvider, useAuth } from './contexts/AuthContext';
// import Login from './components/Login';
// import Dashboard from './components/Dashboard';
// import Profile from './components/Profile';
// import Navbar from './components/Navbar';
// import 'bootstrap/dist/css/bootstrap.min.css';
// import './App.css';

// // Temporary debug component - remove after testing
// function DebugAuth() {
//   const { user, loading } = useAuth();
  
//   return (
//     <div style={{ position: 'fixed', top: 10, right: 10, background: 'white', padding: '10px', border: '1px solid #ccc', zIndex: 1000 }}>
//       <div>Loading: {loading ? 'Yes' : 'No'}</div>
//       <div>User: {user ? user.email : 'None'}</div>
//       <div>Authenticated: {user ? 'Yes' : 'No'}</div>
//     </div>
//   );
// }

// function ProtectedRoute({ children }) {
//   const { user, loading } = useAuth();
  
//   if (loading) {
//     return <div className="d-flex justify-content-center mt-5">Loading...</div>;
//   }
  
//   return user ? children : <Navigate to="/login" />;
// }

// // import { Routes, Route, Navigate } from 'react-router-dom';

// // function App() {
// //   return (
// //     <Routes>
// //       {/* Redirect root path directly to dashboard */}
// //       <Route path="/" element={<Navigate to="/dashboard" replace />} />
// //       <Route path="/login" element={<Navigate to="/dashboard" replace />} />
// //       <Route path="/dashboard" element={<Dashboard />} />
// //       {/* Add other routes as needed */}
// //     </Routes>
// //   );
// // }
// function App() {
//   return (
//     <AuthProvider>
//       <Router>
//         <div className="App">
//           {/* Remove DebugAuth after testing */}
//           <DebugAuth />
//           <Routes>
//             <Route path="/login" element={<Login />} />
//             <Route path="/" element={
//               <ProtectedRoute>
//                 <Navbar />
//                 <Dashboard />
//               </ProtectedRoute>
//             } />
//             <Route path="/dashboard" element={
//               <ProtectedRoute>
//                 <Navbar />
//                 <Dashboard />
//               </ProtectedRoute>
//             } />
//             <Route path="/profile" element={
//               <ProtectedRoute>
//                 <Navbar />
//                 <Profile />
//               </ProtectedRoute>
//             } />
//           </Routes>
//         </div>
//       </Router>
//     </AuthProvider>
//   );
// }

// export default App;
