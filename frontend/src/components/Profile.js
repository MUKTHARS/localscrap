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