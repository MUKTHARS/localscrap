import React, { useState, useEffect } from 'react';
import api from '../utils/apiConfig';
import { useAuth } from '../contexts/AuthContext';
import { formatToAccountTime, AVAILABLE_TIMEZONES } from '../utils/dateUtils';

const Profile = () => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const response = await api.get('/profile');
      setProfileData(response.data);
    } catch (error) {
      console.error('Error fetching profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTimezoneChange = async (e) => {
    const newTz = e.target.value;
    try {
      // Optimistic UI update
      setProfileData(prev => ({
        ...prev,
        user: { ...prev.user, timezone: newTz }
      }));

      await api.put('/user/timezone', { timezone: newTz });
      // Optional: Show a toast notification here
    } catch (error) {
      console.error('Failed to update timezone:', error);
      alert("Failed to save time zone setting.");
      fetchProfileData(); // Revert on error
    }
  };

  const deleteSearch = async (searchId) => {
    if (window.confirm('Delete this search history?')) {
      try {
        await api.delete(`/delete-search/${searchId}`);
        fetchProfileData();
      } catch (error) {
        console.error('Error deleting search:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="container mt-4">
        <div className="d-flex justify-content-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  // Helper to get current TZ safely
  const currentTz = profileData?.user?.timezone || 'UTC';

  return (
    <div className="container mt-4">
      <div className="row">
        {/* User Card */}
        <div className="col-md-4">
          <div className="card shadow-sm">
            <div className="card-body text-center">
              <div className="mb-3">
                <i 
                  className="bi bi-person-circle" 
                  style={{ fontSize: '3rem', color: '#0d6efd' }}
                ></i>
              </div>
              <h5 className="card-title">{user?.name}</h5>
              <p className="card-text text-muted">{user?.email}</p>
              
              <hr />
              
              {/* Time Zone Configuration */}
              <div className="mb-3 text-start">
                <label className="form-label fw-bold small text-muted">
                </label>
                <select 
                  className="form-select form-select-sm" 
                  value={currentTz}
                  onChange={handleTimezoneChange}
                >
                  {AVAILABLE_TIMEZONES.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
                <div className="form-text" style={{fontSize: '0.75rem'}}>
                  Your logs and tickets will be displayed in <strong>{currentTz}</strong> regardless of your device location.
                </div>
              </div>

              <p className="card-text mt-3">
                <small className="text-muted">
                  Member since: {formatToAccountTime(profileData?.user?.created_at, currentTz)}
                </small>
              </p>
            </div>
          </div>
        </div>
        
        {/* Search History */}
        <div className="col-md-8">
          <div className="card shadow-sm">
            <div className="card-header bg-white d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Search History</h5>
              <span className="badge bg-primary">
                {profileData?.search_history.length || 0} searches
              </span>
            </div>
            
            <div className="card-body">
              {profileData?.search_history.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-hover align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Type</th>
                        <th>Brand/Product</th>
                        <th>OEM</th>
                        <th>ASIN</th>
                        <th>Details</th>
                        <th>Website</th>
                        <th>Date ({currentTz})</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profileData.search_history.map((search) => (
                        <tr key={search.id}>
                          <td>
                            <span className={`badge ${search.search_type === 'bulk' ? 'bg-warning' : 'bg-info'}`}>
                              {search.search_type}
                            </span>
                          </td>
                          <td>
                            <div className="fw-bold">{search.brand}</div>
                            <small className="text-muted">{search.product}</small>
                          </td>
                          <td>{search.oem_number || 'N/A'}</td>
                          <td>{search.asin_number || 'N/A'}</td>
                          <td>{search.website || 'All'}</td>
                          <td>
                            {formatToAccountTime(search.created_at, currentTz)}
                          </td>
                          <td>
                            <button
                              className="btn btn-sm btn-outline-danger border-0"
                              onClick={() => deleteSearch(search.id)}
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4">
                  <i 
                    className="bi bi-clock-history" 
                    style={{ fontSize: '3rem', color: '#6c757d' }}
                  ></i>
                  <p className="text-muted mt-3">No search history found.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

// import React, { useState, useEffect } from 'react';
// import api from '../utils/apiConfig';
// import { useAuth } from '../contexts/AuthContext';

// // Format for user join date (shows UTC time)
// const formatUserJoinDate = (utcDateString) => {
//     if (!utcDateString) return 'Date not available';
//     try {
//         const date = new Date(utcDateString);
//         if (isNaN(date.getTime())) return 'Invalid date';
        
//         return date.toLocaleString('en-US', {
//             year: 'numeric',
//             month: '2-digit',
//             day: '2-digit',
//             hour: '2-digit',
//             minute: '2-digit',
//             hour12: true,
//             timeZone: 'UTC'
//         });
//     } catch (error) {
//         console.error('Error formatting date:', error);
//         return 'Invalid date';
//     }
// };

// // Format for search history (shows local time)
// const formatSearchHistoryDate = (utcDateString) => {
//     if (!utcDateString) return 'Date not available';
//     try {
//         const date = new Date(utcDateString);
//         if (isNaN(date.getTime())) return 'Invalid date';
        
//         return date.toLocaleString('en-US', {
//             year: 'numeric',
//             month: '2-digit',
//             day: '2-digit',
//             hour: '2-digit',
//             minute: '2-digit',
//             hour12: true
//         });
//     } catch (error) {
//         console.error('Error formatting date:', error);
//         return 'Invalid date';
//     }
// };

// const getMemberSinceDate = (userData, authUser) => {
//     if (userData?.user?.created_at) return userData.user.created_at;
//     if (authUser?.created_at) return authUser.created_at;
//     return new Date().toISOString();
// };

// const Profile = () => {
//   const [profileData, setProfileData] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const { user } = useAuth();

//   useEffect(() => {
//     fetchProfileData();
//   }, []);

//   const fetchProfileData = async () => {
//     try {
//       const response = await api.get('/profile');
//       setProfileData(response.data);
//     } catch (error) {
//       console.error('Error fetching profile data:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const deleteSearch = async (searchId) => {
//     if (window.confirm('Delete this search history?')) {
//       try {
//         await api.delete(`/delete-search/${searchId}`);
//         fetchProfileData();
//       } catch (error) {
//         console.error('Error deleting search:', error);
//       }
//     }
//   };

//   if (loading) {
//     return (
//       <div className="container mt-4">
//         <div className="d-flex justify-content-center">
//           <div className="spinner-border" role="status">
//             <span className="visually-hidden">Loading...</span>
//           </div>
//         </div>
//       </div>
//     );
//   }

//    return (
//     <div className="container mt-4">
//       <div className="row">
//         <div className="col-md-4">
//           <div className="card">
//             <div className="card-body text-center">
//               <div className="mb-3">
//                 <i 
//                   className="bi bi-person-circle" 
//                   style={{ fontSize: '3rem', color: '#0d6efd' }}
//                 ></i>
//               </div>
//               <h5 className="card-title">{user?.name}</h5>
//               <p className="card-text text-muted">{user?.email}</p>
//               <p className="card-text">
//                 <small className="text-muted">
//                   Member since: {formatUserJoinDate(getMemberSinceDate(profileData, user))}
//                 </small>
//               </p>
//             </div>
//           </div>
//         </div>
        
//         <div className="col-md-8">
//           <div className="card">
//             <div className="card-header d-flex justify-content-between align-items-center">
//               <h5 className="mb-0">Search History</h5>
//               <span className="badge bg-primary">
//                 {profileData?.search_history.length || 0} searches
//               </span>
//             </div>
            
//             <div className="card-body">
//               {profileData?.search_history.length > 0 ? (
//                 <div className="table-responsive">
//                   <table className="table table-striped">
//                     <thead>
//                       <tr>
//                         <th>Type</th>
//                         <th>Brand</th>
//                         <th>Product</th>
//                         <th>OEM</th>
//                         <th>ASIN</th>
//                         <th>Website</th>
//                         <th>Date</th>
//                         <th>Action</th>
//                       </tr>
//                     </thead>
//                     <tbody>
//                       {profileData.search_history.map((search) => (
//                         <tr key={search.id}>
//                           <td>
//                             <span 
//                               className={`badge ${
//                                 search.search_type === 'bulk' ? 'bg-warning' : 'bg-info'
//                               }`}
//                             >
//                               {search.search_type}
//                             </span>
//                           </td>
//                           <td>{search.brand}</td>
//                           <td>{search.product}</td>
//                           <td>{search.oem_number || 'N/A'}</td>
//                           <td>{search.asin_number || 'N/A'}</td>
//                           <td>{search.website || 'All'}</td>
//                           <td>
//                             {formatSearchHistoryDate(search.created_at)}
//                           </td>
//                           <td>
//                             <button
//                               className="btn btn-sm btn-outline-danger"
//                               onClick={() => deleteSearch(search.id)}
//                             >
//                               <i className="bi bi-trash"></i>
//                             </button>
//                           </td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 </div>
//               ) : (
//                 <div className="text-center py-4">
//                   <i 
//                     className="bi bi-clock-history" 
//                     style={{ fontSize: '3rem', color: '#6c757d' }}
//                   ></i>
//                   <p className="text-muted mt-3">No search history found.</p>
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default Profile;

// import React, { useState, useEffect } from 'react';
// import api from '../utils/apiConfig';
// import { useAuth } from '../contexts/AuthContext';
// import SupportTickets from './SupportTickets';

// // Format for user join date (shows UTC time)
// const formatUserJoinDate = (utcDateString) => {
//     if (!utcDateString) return 'Date not available';
    
//     try {
//         const date = new Date(utcDateString);
        
//         if (isNaN(date.getTime())) {
//             return 'Invalid date';
//         }
        
//         // For user join date, show UTC time as stored in database
//         return date.toLocaleString('en-US', {
//             year: 'numeric',
//             month: '2-digit',
//             day: '2-digit',
//             hour: '2-digit',
//             minute: '2-digit',
//             hour12: true,
//             timeZone: 'UTC'
//         });
//     } catch (error) {
//         console.error('Error formatting date:', error);
//         return 'Invalid date';
//     }
// };

// // Format for search history (shows local time)
// const formatSearchHistoryDate = (utcDateString) => {
//     if (!utcDateString) return 'Date not available';
    
//     try {
//         const date = new Date(utcDateString);
        
//         if (isNaN(date.getTime())) {
//             return 'Invalid date';
//         }
        
//         // For search history, show local time for better user experience
//         return date.toLocaleString('en-US', {
//             year: 'numeric',
//             month: '2-digit',
//             day: '2-digit',
//             hour: '2-digit',
//             minute: '2-digit',
//             hour12: true
//             // No timeZone specified - uses local timezone
//         });
//     } catch (error) {
//         console.error('Error formatting date:', error);
//         return 'Invalid date';
//     }
// };

// const getMemberSinceDate = (userData, authUser) => {
//     if (userData?.user?.created_at) {
//         return userData.user.created_at;
//     }
    
//     if (authUser?.created_at) {
//         return authUser.created_at;
//     }
    
//     return new Date().toISOString();
// };

// const Profile = () => {
//   const [profileData, setProfileData] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [showTickets, setShowTickets] = useState(false);
//   const { user } = useAuth();

//   useEffect(() => {
//     fetchProfileData();
//   }, []);

//   const fetchProfileData = async () => {
//     try {
//       const response = await api.get('/profile');
//       setProfileData(response.data);
//     } catch (error) {
//       console.error('Error fetching profile data:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const deleteSearch = async (searchId) => {
//     if (window.confirm('Delete this search history?')) {
//       try {
//         // ✅ CORRECT - use api instance
//         await api.delete(`/delete-search/${searchId}`);
//         fetchProfileData();
//       } catch (error) {
//         console.error('Error deleting search:', error);
//       }
//     }
//   };

//   if (loading) {
//     return (
//       <div className="container mt-4">
//         <div className="d-flex justify-content-center">
//           <div className="spinner-border" role="status">
//             <span className="visually-hidden">Loading...</span>
//           </div>
//         </div>
//       </div>
//     );
//   }

//    return (
//     <div className="container mt-4">
//       {showTickets ? (
//         <SupportTickets onBack={() => setShowTickets(false)} />
//       ) : (
//         <div className="row">
//           <div className="col-md-4">
//             <div className="card">
//               <div className="card-body text-center">
//                 <div className="mb-3">
//                   <i 
//                     className="bi bi-person-circle" 
//                     style={{ fontSize: '3rem', color: '#0d6efd' }}
//                   ></i>
//                 </div>
//                 <h5 className="card-title">{user?.name}</h5>
//                 <p className="card-text text-muted">{user?.email}</p>
//                 <p className="card-text">
//                   <small className="text-muted">
//                     Member since: {formatUserJoinDate(getMemberSinceDate(profileData, user))}
//                   </small>
//                 </p>
                
//                 {/* Ticket Button */}
//                 <button
//                   className="btn btn-warning mt-3"
//                   onClick={() => setShowTickets(true)}
//                 >
//                   <i className="bi bi-ticket-perforated me-2"></i>
//                   Support Tickets
//                 </button>
//               </div>
//             </div>
//           </div>
          
//           <div className="col-md-8">
//             <div className="card">
//               <div className="card-header d-flex justify-content-between align-items-center">
//                 <h5 className="mb-0">Search History</h5>
//                 <span className="badge bg-primary">
//                   {profileData?.search_history.length || 0} searches
//                 </span>
//               </div>
              
//               <div className="card-body">
//                 {profileData?.search_history.length > 0 ? (
//                   <div className="table-responsive">
//                     <table className="table table-striped">
//                       <thead>
//                         <tr>
//                           <th>Type</th>
//                           <th>Brand</th>
//                           <th>Product</th>
//                           <th>OEM</th>
//                           <th>ASIN</th>
//                           <th>Website</th>
//                           <th>Date</th>
//                           <th>Action</th>
//                         </tr>
//                       </thead>
//                       <tbody>
//                         {profileData.search_history.map((search) => (
//                           <tr key={search.id}>
//                             <td>
//                               <span 
//                                 className={`badge ${
//                                   search.search_type === 'bulk' ? 'bg-warning' : 'bg-info'
//                                 }`}
//                               >
//                                 {search.search_type}
//                               </span>
//                             </td>
//                             <td>{search.brand}</td>
//                             <td>{search.product}</td>
//                             <td>{search.oem_number || 'N/A'}</td>
//                             <td>{search.asin_number || 'N/A'}</td>
//                             <td>{search.website || 'All'}</td>
//                             <td>
//                               {formatSearchHistoryDate(search.created_at)}
//                             </td>
//                             <td>
//                               <button
//                                 className="btn btn-sm btn-outline-danger"
//                                 onClick={() => deleteSearch(search.id)}
//                               >
//                                 <i className="bi bi-trash"></i>
//                               </button>
//                             </td>
//                           </tr>
//                         ))}
//                       </tbody>
//                     </table>
//                   </div>
//                 ) : (
//                   <div className="text-center py-4">
//                     <i 
//                       className="bi bi-clock-history" 
//                       style={{ fontSize: '3rem', color: '#6c757d' }}
//                     ></i>
//                     <p className="text-muted mt-3">No search history found.</p>
//                   </div>
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };


// export default Profile;

// import React, { useState, useEffect } from 'react';
// import api from '../utils/apiConfig'; // ✅ Add this import
// import { useAuth } from '../contexts/AuthContext';

// // Format for user join date (shows UTC time)
// const formatUserJoinDate = (utcDateString) => {
//     if (!utcDateString) return 'Date not available';
    
//     try {
//         const date = new Date(utcDateString);
        
//         if (isNaN(date.getTime())) {
//             return 'Invalid date';
//         }
        
//         // For user join date, show UTC time as stored in database
//         return date.toLocaleString('en-US', {
//             year: 'numeric',
//             month: '2-digit',
//             day: '2-digit',
//             hour: '2-digit',
//             minute: '2-digit',
//             hour12: true,
//             timeZone: 'UTC'
//         });
//     } catch (error) {
//         console.error('Error formatting date:', error);
//         return 'Invalid date';
//     }
// };

// // Format for search history (shows local time)
// const formatSearchHistoryDate = (utcDateString) => {
//     if (!utcDateString) return 'Date not available';
    
//     try {
//         const date = new Date(utcDateString);
        
//         if (isNaN(date.getTime())) {
//             return 'Invalid date';
//         }
        
//         // For search history, show local time for better user experience
//         return date.toLocaleString('en-US', {
//             year: 'numeric',
//             month: '2-digit',
//             day: '2-digit',
//             hour: '2-digit',
//             minute: '2-digit',
//             hour12: true
//             // No timeZone specified - uses local timezone
//         });
//     } catch (error) {
//         console.error('Error formatting date:', error);
//         return 'Invalid date';
//     }
// };

// const getMemberSinceDate = (userData, authUser) => {
//     if (userData?.user?.created_at) {
//         return userData.user.created_at;
//     }
    
//     if (authUser?.created_at) {
//         return authUser.created_at;
//     }
    
//     return new Date().toISOString();
// };

// const Profile = () => {
//   const [profileData, setProfileData] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const { user } = useAuth();

//   useEffect(() => {
//     fetchProfileData();
//   }, []);

//   const fetchProfileData = async () => {
//     try {
//       // ✅ CORRECT - use api instance
//       const response = await api.get('/profile');
//       setProfileData(response.data);
//     } catch (error) {
//       console.error('Error fetching profile data:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const deleteSearch = async (searchId) => {
//     if (window.confirm('Delete this search history?')) {
//       try {
//         // ✅ CORRECT - use api instance
//         await api.delete(`/delete-search/${searchId}`);
//         fetchProfileData();
//       } catch (error) {
//         console.error('Error deleting search:', error);
//       }
//     }
//   };

//   if (loading) {
//     return (
//       <div className="container mt-4">
//         <div className="d-flex justify-content-center">
//           <div className="spinner-border" role="status">
//             <span className="visually-hidden">Loading...</span>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="container mt-4">
//       <div className="row">
//         <div className="col-md-4">
//           <div className="card">
//             <div className="card-body text-center">
//               <div className="mb-3">
//                 <i 
//                   className="bi bi-person-circle" 
//                   style={{ fontSize: '3rem', color: '#0d6efd' }}
//                 ></i>
//               </div>
//               <h5 className="card-title">{user?.name}</h5>
//               <p className="card-text text-muted">{user?.email}</p>
//               <p className="card-text">
//                 <small className="text-muted">
//                   Member since: {formatUserJoinDate(getMemberSinceDate(profileData, user))}
//                 </small>
//               </p>
//             </div>
//           </div>
//         </div>
        
//         <div className="col-md-8">
//           <div className="card">
//             <div className="card-header d-flex justify-content-between align-items-center">
//               <h5 className="mb-0">Search History</h5>
//               <span className="badge bg-primary">
//                 {profileData?.search_history.length || 0} searches
//               </span>
//             </div>
            
//             <div className="card-body">
//               {profileData?.search_history.length > 0 ? (
//                 <div className="table-responsive">
//                   <table className="table table-striped">
//                     <thead>
//                       <tr>
//                         <th>Type</th>
//                         <th>Brand</th>
//                         <th>Product</th>
//                         <th>OEM</th>
//                         <th>ASIN</th>
//                         <th>Website</th>
//                         <th>Date</th>
//                         <th>Action</th>
//                       </tr>
//                     </thead>
//                     <tbody>
//                       {profileData.search_history.map((search) => (
//                         <tr key={search.id}>
//                           <td>
//                             <span 
//                               className={`badge ${
//                                 search.search_type === 'bulk' ? 'bg-warning' : 'bg-info'
//                               }`}
//                             >
//                               {search.search_type}
//                             </span>
//                           </td>
//                           <td>{search.brand}</td>
//                           <td>{search.product}</td>
//                           <td>{search.oem_number || 'N/A'}</td>
//                           <td>{search.asin_number || 'N/A'}</td>
//                           <td>{search.website || 'All'}</td>
//                           <td>
//                             {formatSearchHistoryDate(search.created_at)}
//                           </td>
//                           <td>
//                             <button
//                               className="btn btn-sm btn-outline-danger"
//                               onClick={() => deleteSearch(search.id)}
//                             >
//                               <i className="bi bi-trash"></i>
//                             </button>
//                           </td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 </div>
//               ) : (
//                 <div className="text-center py-4">
//                   <i 
//                     className="bi bi-clock-history" 
//                     style={{ fontSize: '3rem', color: '#6c757d' }}
//                   ></i>
//                   <p className="text-muted mt-3">No search history found.</p>
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default Profile;
