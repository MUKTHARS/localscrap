import React, { useState, useEffect } from 'react';
import api from '../utils/apiConfig';
import { useAuth } from '../contexts/AuthContext';
import { formatToAccountTime } from '../utils/dateUtils';
import '../styles/History.css';

const History = () => {
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'manual', 'bulk'
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await api.get('/profile');
      setHistoryData(response.data.search_history || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteSearch = async (searchId) => {
    if (window.confirm('Delete this search history?')) {
      try {
        await api.delete(`/delete-search/${searchId}`);
        fetchHistory();
      } catch (error) {
        console.error('Error deleting search:', error);
        alert('Failed to delete search history');
      }
    }
  };

  const deleteAll = async () => {
    if (window.confirm('Delete ALL search history? This action cannot be undone.')) {
      try {
        // Delete all searches one by one
        const deletePromises = historyData.map(item => 
          api.delete(`/delete-search/${item.id}`).catch(() => null)
        );
        await Promise.all(deletePromises);
        fetchHistory();
      } catch (error) {
        console.error('Error deleting all:', error);
        alert('Failed to delete all history');
      }
    }
  };

  const filteredHistory = historyData.filter(item => {
    // Filter by type
    if (filter !== 'all' && item.search_type !== filter) {
      return false;
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (item.brand || '').toLowerCase().includes(term) ||
        (item.product || '').toLowerCase().includes(term) ||
        (item.website || '').toLowerCase().includes(term)
      );
    }
    
    return true;
  });

  if (loading) {
    return (
      <div className="history-container">
        <div className="d-flex justify-content-center align-items-center" style={{ height: '300px' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="history-container">
      {/* Header */}
      <div className="history-header">
        <div className="header-content">
          <h1 className="history-title">
            <i className="bi bi-clock-history me-2"></i>
            Search History
          </h1>
          <p className="history-subtitle">
            Track all your previous searches and bulk uploads
          </p>
        </div>
        
        <div className="header-actions">
          <button 
            className="btn btn-outline-danger"
            onClick={deleteAll}
            disabled={historyData.length === 0}
          >
            <i className="bi bi-trash me-1"></i>
            Clear All History
          </button>
        </div>
      </div>

      {/* Stats & Filters */}
      <div className="history-stats-section">
        <div className="stats-card">
          <div className="stat-item">
            <div className="stat-number">{historyData.length}</div>
            <div className="stat-label">Total Searches</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">
              {historyData.filter(h => h.search_type === 'manual').length}
            </div>
            <div className="stat-label">Manual Searches</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">
              {historyData.filter(h => h.search_type === 'bulk').length}
            </div>
            <div className="stat-label">Bulk Uploads</div>
          </div>
        </div>

        <div className="history-filters">
          <div className="filter-group">
            <label className="filter-label">Filter by Type:</label>
            <div className="filter-buttons">
              <button
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button
                className={`filter-btn ${filter === 'manual' ? 'active' : ''}`}
                onClick={() => setFilter('manual')}
              >
                Manual
              </button>
              <button
                className={`filter-btn ${filter === 'bulk' ? 'active' : ''}`}
                onClick={() => setFilter('bulk')}
              >
                Bulk
              </button>
            </div>
          </div>

          <div className="search-group">
            <div className="input-wrapper">
              <i className="bi bi-search input-icon"></i>
              <input
                type="text"
                className="form-control search-input"
                placeholder="Search in history..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="history-table-section">
        {filteredHistory.length > 0 ? (
          <div className="table-responsive">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Brand / Store</th>
                  <th>Product</th>
                  <th>OEM / ASIN</th>
                  <th>Website</th>
                  <th>Date ({user?.timezone || 'UTC'})</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((search) => (
                  <tr key={search.id}>
                    <td>
                      <span className={`badge ${search.search_type === 'bulk' ? 'badge-warning' : 'badge-info'}`}>
                        {search.search_type === 'bulk' ? 'Bulk Upload' : 'Manual'}
                      </span>
                    </td>
                    <td>
                      <div className="fw-bold">{search.brand || 'N/A'}</div>
                    </td>
                    <td>
                      <div className="text-truncate" style={{ maxWidth: '200px' }} title={search.product}>
                        {search.product || 'N/A'}
                      </div>
                    </td>
                    <td>
                      <div>
                        {search.oem_number && (
                          <div className="small">
                            <span className="text-muted">OEM: </span>
                            {search.oem_number}
                          </div>
                        )}
                        {search.asin_number && (
                          <div className="small">
                            <span className="text-muted">ASIN: </span>
                            {search.asin_number}
                          </div>
                        )}
                        {!search.oem_number && !search.asin_number && '-'}
                      </div>
                    </td>
                    <td>
                      <span className="website-badge">
                        {search.website || 'All Websites'}
                      </span>
                    </td>
                    <td>
                      {formatToAccountTime(search.created_at, user?.timezone)}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => deleteSearch(search.id)}
                          title="Delete"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-history">
            <div className="empty-icon">
              <i className="bi bi-clock-history"></i>
            </div>
            <h4>No Search History Found</h4>
            <p className="text-muted">
              {searchTerm || filter !== 'all' 
                ? 'No results match your filters. Try changing them.' 
                : 'Your search history will appear here after you perform searches.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default History;