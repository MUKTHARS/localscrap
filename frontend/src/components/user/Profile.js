import React, { useState, useEffect } from 'react';
import api from '../../utils/apiConfig';
import { useAuth } from '../../contexts/AuthContext';
import { formatToAccountTime } from '../../utils/dateUtils';
import { Link } from 'react-router-dom';
import '../../styles/Profile.css';

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
      <div className="premium-profile-page">
        <div className="premium-profile-loading">
          <div className="spinner-border premium-spinner" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  const currentTz = profileData?.user?.timezone || 'UTC';
  const searchHistory = profileData?.search_history || [];
  const manualSearches = searchHistory.filter(h => h.search_type === 'manual').length;
  const bulkUploads = searchHistory.filter(h => h.search_type === 'bulk').length;

  return (
    <div className="premium-profile-page">
      <div className="premium-profile-container">
        {/* Header */}
        <div className="premium-profile-header">
          <h1>Profile Overview</h1>
          <p>Your account details and search statistics at a glance</p>
        </div>

        {/* Main Content Grid */}
        <div className="premium-profile-content">
          {/* Profile Card */}
          <div className="premium-profile-card">
            <div className="premium-card-header">
              <div className="premium-avatar">
                <i className="bi bi-person-circle"></i>
              </div>
              <h2 className="premium-user-name">{user?.name}</h2>
              <p className="premium-user-email">{user?.email}</p>
            </div>
            
            <div className="premium-card-body">
              <div className="premium-info-item">
                <div className="premium-info-icon">
                  <i className="bi bi-geo-alt-fill"></i>
                </div>
                <div className="premium-info-content">
                  <span className="premium-info-label">Timezone</span>
                  <p className="premium-info-value">{currentTz}</p>
                </div>
              </div>
              
              <div className="premium-info-item">
                <div className="premium-info-icon">
                  <i className="bi bi-calendar-check"></i>
                </div>
                <div className="premium-info-content">
                  <span className="premium-info-label">Member Since</span>
                  <p className="premium-info-value">
                    {formatToAccountTime(profileData?.user?.created_at, currentTz, 'MMM DD, YYYY')}
                  </p>
                </div>
              </div>
              
              <div className="premium-info-item">
                <div className="premium-info-icon">
                  <i className="bi bi-shield-check"></i>
                </div>
                <div className="premium-info-content">
                  <span className="premium-info-label">Account Status</span>
                  <div>
                    <span className="premium-status-badge">Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Card */}
          <div className="premium-stats-card">
            <h3 className="premium-stats-title">Search Statistics</h3>
            
            <div className="premium-stats-grid">
              <div className="premium-stat-item">
                <div className="premium-stat-number">{searchHistory.length}</div>
                <div className="premium-stat-label">Total Searches</div>
              </div>
              
              <div className="premium-stat-item">
                <div className="premium-stat-number">{manualSearches}</div>
                <div className="premium-stat-label">Manual Searches</div>
              </div>
              
              <div className="premium-stat-item">
                <div className="premium-stat-number">{bulkUploads}</div>
                <div className="premium-stat-label">Bulk Uploads</div>
              </div>
              
              <div className="premium-stat-item">
                <div className="premium-stat-number">
                  {new Set(searchHistory.map(h => h.website)).size}
                </div>
                <div className="premium-stat-label">Websites Used</div>
              </div>
            </div>
          </div>
        </div>


      </div>
    </div>
  );
};

export default Profile;