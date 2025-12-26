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
      setProfileData(prev => ({
        ...prev,
        user: { ...prev.user, timezone: newTz }
      }));
      await api.put('/user/timezone', { timezone: newTz });
    } catch (error) {
      console.error('Failed to update timezone:', error);
      alert("Failed to save time zone setting.");
      fetchProfileData();
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
      <div className="container mt-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  const currentTz = profileData?.user?.timezone || 'UTC';

  return (
    <div className="container mt-4">
      <div className="row g-4"> {/* g-4 adds consistent gutter spacing */}
        
        {/* Left Column: User Profile (Sticky) */}
        <div className="col-lg-3 col-md-4">
          <div className="card shadow-sm border-0" style={{ position: 'sticky', top: '20px' }}>
            <div className="card-body text-center p-4">
              
              {/* Avatar Section */}
              <div className="mb-3">
                <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center mx-auto" 
                     style={{ width: '80px', height: '80px', fontSize: '2.5rem', color: 'white' }}>
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
              </div>
              <h5 className="card-title fw-bold mb-1">{user?.name}</h5>
              <p className="text-muted small mb-4">{user?.email}</p>
              
              <hr className="my-4 opacity-10" />
              
              {/* Time Zone Section (Centered) */}
              <div className="mb-4">
                <label className="form-label fw-bold small text-uppercase text-muted mb-2">
                  <i className="bi bi-globe me-1"></i> Account Time Zone
                </label>
                <select 
                  className="form-select form-select-sm text-center mx-auto" 
                  value={currentTz}
                  onChange={handleTimezoneChange}
                  style={{ maxWidth: '200px', cursor: 'pointer' }}
                >
                  {AVAILABLE_TIMEZONES.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
                <div className="form-text mt-2" style={{ fontSize: '0.75rem', lineHeight: '1.4' }}>
                  All dates will be displayed in <strong>{currentTz}</strong>.
                </div>
              </div>

              {/* Member Since Footer */}
              <div className="mt-auto pt-2">
                <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                  Member since: <br/>
                  {formatToAccountTime(profileData?.user?.created_at, currentTz)}
                </small>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Column: Search History */}
        <div className="col-lg-9 col-md-8">
          <div className="card shadow-sm border-0">
            <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center border-bottom">
              <h5 className="mb-0 fw-bold">Search History</h5>
              <span className="badge bg-primary rounded-pill px-3">
                {profileData?.search_history.length || 0} Searches
              </span>
            </div>
            
            <div className="card-body p-0">
              {profileData?.search_history.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="bg-light text-secondary small text-uppercase">
                      <tr>
                        <th className="ps-4 py-3 border-0">Type</th>
                        <th className="py-3 border-0">Brand/Product</th>
                        <th className="py-3 border-0">Details</th>
                        <th className="py-3 border-0">Website</th>
                        <th className="py-3 border-0">Date ({currentTz})</th>
                        <th className="text-end pe-4 py-3 border-0">Action</th>
                      </tr>
                    </thead>
                    <tbody className="border-top-0">
                      {profileData.search_history.map((search) => (
                        <tr key={search.id}>
                          <td className="ps-4">
                            <span className={`badge ${search.search_type === 'bulk' ? 'bg-warning text-dark' : 'bg-info text-white'}`} 
                                  style={{ width: '60px' }}>
                              {search.search_type.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <div className="fw-bold text-dark">{search.brand}</div>
                            <small className="text-muted">{search.product}</small>
                          </td>
                          <td>
                            {(search.oem_number || search.asin_number) ? (
                              <div className="small text-muted">
                                {search.oem_number && <div>OEM: {search.oem_number}</div>}
                                {search.asin_number && <div>ASIN: {search.asin_number}</div>}
                              </div>
                            ) : (
                              <span className="text-muted small">—</span>
                            )}
                          </td>
                          <td>
                            <span className="badge bg-light text-dark border">
                              {search.website || 'All'}
                            </span>
                          </td>
                          <td className="small text-nowrap">
                            {formatToAccountTime(search.created_at, currentTz)}
                          </td>
                          <td className="text-end pe-4">
                            <button
                              className="btn btn-sm btn-outline-danger border-0 rounded-circle"
                              onClick={() => deleteSearch(search.id)}
                              title="Delete Entry"
                              style={{ width: '32px', height: '32px' }}
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
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-clock-history display-4 mb-3 d-block opacity-50"></i>
                  <p className="mb-0">No search history found.</p>
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
