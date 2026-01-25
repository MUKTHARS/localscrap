import React, { useState, useEffect } from 'react';
import api from '../utils/apiConfig';
import { useAuth } from '../contexts/AuthContext';
import { formatToAccountTime } from '../utils/dateUtils';

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

  const currentTz = profileData?.user?.timezone || 'UTC';

  return (
    <div className="container mt-4">
      <div className="row justify-content-center">
        {/* Profile Card Only */}
        <div className="col-md-6">
          <div className="card shadow-lg">
            <div className="card-header bg-primary text-white text-center py-4">
              <div className="mb-3">
                <i
                  className="bi bi-person-circle"
                  style={{ fontSize: '4rem', color: 'white' }}
                ></i>
              </div>
              <h3 className="card-title mb-1">{user?.name}</h3>
              <p className="card-text opacity-75">{user?.email}</p>
            </div>
            
            <div className="card-body p-4">
              <div className="row">
                <div className="col-12 mb-4">
                  <div className="d-flex align-items-center mb-3">
                    <i className="bi bi-geo-alt-fill text-primary me-3" style={{ fontSize: '1.5rem' }}></i>
                    <div>
                      <h6 className="mb-0 text-muted">Timezone</h6>
                      <h5 className="mb-0">{currentTz}</h5>
                    </div>
                  </div>
                  
                  <div className="d-flex align-items-center mb-3">
                    <i className="bi bi-calendar-check text-primary me-3" style={{ fontSize: '1.5rem' }}></i>
                    <div>
                      <h6 className="mb-0 text-muted">Member Since</h6>
                      <h5 className="mb-0">
                        {formatToAccountTime(profileData?.user?.created_at, currentTz, 'MMM DD, YYYY')}
                      </h5>
                    </div>
                  </div>
                  
                  <div className="d-flex align-items-center">
                    <i className="bi bi-shield-check text-primary me-3" style={{ fontSize: '1.5rem' }}></i>
                    <div>
                      <h6 className="mb-0 text-muted">Account Status</h6>
                      <h5 className="mb-0">
                        <span className="badge bg-success">Active</span>
                      </h5>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-3 border-top">
                <div className="text-center">
                  <p className="text-muted mb-3">
                    <i className="bi bi-info-circle me-2"></i>
                    View your complete search history in the History section
                  </p>
                  <a href="/history" className="btn btn-primary">
                    <i className="bi bi-clock-history me-2"></i>
                    Go to Search History
                  </a>
                </div>
              </div>
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
// import { formatToAccountTime } from '../utils/dateUtils';

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

//   const currentTz = profileData?.user?.timezone || 'UTC';

//   return (
//     <div className="container mt-4">
//       <div className="row">
//         {/* Profile Card */}
//         <div className="col-md-4">
//           <div className="card shadow-sm">
//             <div className="card-body text-center">
//               <div className="mb-3">
//                 <i
//                   className="bi bi-person-circle"
//                   style={{ fontSize: '3rem', color: '#0d6efd' }}
//                 ></i>
//               </div>

//               <h5 className="card-title">{user?.name}</h5>
//               <p className="card-text text-muted">{user?.email}</p>

//               <hr />

//               <div className="mb-3">
//                 <span className="badge bg-light text-dark border px-3 py-2">
//                   <i className="bi bi-geo-alt-fill me-2 text-danger"></i>
//                   Region: <strong>{currentTz}</strong>
//                 </span>
//               </div>

//               <p className="card-text mt-3">
//                 <small className="text-muted">
//                   Member since:{' '}
//                   {formatToAccountTime(
//                     profileData?.user?.created_at,
//                     currentTz
//                   )}
//                 </small>
//               </p>
//             </div>
//           </div>
//         </div>

//         {/* Search History */}
//         <div className="col-md-8">
//           <div className="card shadow-sm">
//             <div className="card-header bg-white d-flex justify-content-between align-items-center">
//               <h5 className="mb-0">Search History</h5>
//               <span className="badge bg-primary">
//                 {profileData?.search_history.length || 0} searches
//               </span>
//             </div>

//             <div className="card-body">
//               {profileData?.search_history.length > 0 ? (
//                 <div className="table-responsive">
//                   <table className="table table-hover align-middle">
//                     <thead className="table-light">
//                       <tr>
//                         <th>Type</th>
//                         <th>Brand/Product</th>
//                         <th>OEM</th>
//                         <th>ASIN</th>
//                         <th>Website</th>
//                         <th>Date ({currentTz})</th>
//                         <th>Action</th>
//                       </tr>
//                     </thead>
//                     <tbody>
//                       {profileData.search_history.map((search) => (
//                         <tr key={search.id}>
//                           <td>
//                             <span
//                               className={`badge ${
//                                 search.search_type === 'bulk'
//                                   ? 'bg-warning'
//                                   : 'bg-info'
//                               }`}
//                             >
//                               {search.search_type}
//                             </span>
//                           </td>

//                           <td>
//                             <div className="fw-bold">{search.brand}</div>
//                             <small className="text-muted">
//                               {search.product}
//                             </small>
//                           </td>

//                           <td>{search.oem_number || 'N/A'}</td>
//                           <td>{search.asin_number || 'N/A'}</td>
//                           <td>{search.website || 'All'}</td>

//                           <td>
//                             {formatToAccountTime(
//                               search.created_at,
//                               currentTz
//                             )}
//                           </td>

//                           <td>
//                             <button
//                               className="btn btn-sm btn-outline-danger border-0"
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
//                   <p className="text-muted mt-3">
//                     No search history found.
//                   </p>
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