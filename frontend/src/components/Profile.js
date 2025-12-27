import React, { useState, useEffect } from 'react';
import api from '../utils/apiConfig';
import { useAuth } from '../contexts/AuthContext';
import { formatToAccountTime } from '../utils/dateUtils';

const AVAILABLE_TIMEZONES = [
  "UTC",
  "Asia/Dubai",
  "Asia/Kolkata",
  "America/New_York",
  "Europe/London",
  "Asia/Singapore",
  "Australia/Sydney"
];

const Profile = () => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user, setUser } = useAuth();
  
  const [isEditingTz, setIsEditingTz] = useState(false);
  const [selectedTz, setSelectedTz] = useState('');
  const [tzLoading, setTzLoading] = useState(false);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const response = await api.get('/api/profile');
      setProfileData(response.data);
      setSelectedTz(response.data.user.timezone || 'UTC');
    } catch (error) {
      console.error('Error fetching profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTimezoneUpdate = async () => {
    setTzLoading(true);
    try {
      const response = await api.put('/api/user/timezone', {
        timezone: selectedTz
      });
      
      setProfileData(prev => ({
        ...prev,
        user: { ...prev.user, timezone: selectedTz }
      }));
      
      if (user && setUser) {
        setUser({ ...user, timezone: selectedTz });
      }

      setIsEditingTz(false);
      alert(`Timezone updated to ${selectedTz}`);
    } catch (error) {
      alert('Failed to update timezone');
    } finally {
      setTzLoading(false);
    }
  };

  const deleteSearch = async (searchId) => {
    if (window.confirm('Delete this search history?')) {
      try {
        await api.delete(`/api/delete-search/${searchId}`);
        fetchProfileData();
      } catch (error) {
        console.error('Error deleting search:', error);
      }
    }
  };

  if (loading) return <div className="p-5 text-center">Loading Profile...</div>;

  const currentTz = profileData?.user?.timezone || 'UTC';

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-md-4">
          <div className="card shadow-sm">
            <div className="card-body text-center">
              <div className="mb-3">
                <i className="bi bi-person-circle" style={{ fontSize: '3rem', color: '#0d6efd' }}></i>
              </div>
              <h5 className="card-title">{profileData?.user?.name}</h5>
              <p className="card-text text-muted">{profileData?.user?.email}</p>
              
              <hr />
              
              <div className="mb-3">
                <label className="form-label fw-bold text-muted small">ACCOUNT TIME ZONE</label>
                
                {!isEditingTz ? (
                  <div className="d-flex justify-content-center align-items-center gap-2">
                    <span className="badge bg-light text-dark border px-3 py-2 fs-6">
                      <i className="bi bi-geo-alt-fill me-2 text-danger"></i>
                      {currentTz}
                    </span>
                    <button 
                      className="btn btn-sm btn-link"
                      onClick={() => setIsEditingTz(true)}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="mt-2">
                    <select 
                      className="form-select mb-2" 
                      value={selectedTz} 
                      onChange={(e) => setSelectedTz(e.target.value)}
                    >
                      {AVAILABLE_TIMEZONES.map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                    <div className="d-flex gap-2 justify-content-center">
                      <button 
                        className="btn btn-sm btn-success"
                        onClick={handleTimezoneUpdate}
                        disabled={tzLoading}
                      >
                        {tzLoading ? 'Saving...' : 'Save'}
                      </button>
                      <button 
                        className="btn btn-sm btn-secondary"
                        onClick={() => {
                          setIsEditingTz(false);
                          setSelectedTz(currentTz);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                <div className="form-text small mt-2">
                   This setting controls how dates appear on your Dashboard.
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
        
        <div className="col-md-8">
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
