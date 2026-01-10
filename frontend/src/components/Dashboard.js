import React, { useState, useCallback, useMemo } from 'react';
import api from '../utils/apiConfig';
import { useAuth } from '../contexts/AuthContext';
import { formatToAccountTime } from '../utils/dateUtils';
import { getFormattedCurrency } from '../utils/currencyUtils';
import ChatWidget from './ChatWidget';
import '../styles/Dashboard.css';
import '../styles/Table.css';

const Dashboard = () => {
  const { user } = useAuth();

  // --- State Management ---
  const [formData, setFormData] = useState({
    brand: '',
    product: '',
    oem_number: '',
    asin_number: '',
    website: '', // Default to empty (All Websites)
    amazon_country: 'amazon.com',
    store_url: ''
  });

  const [bulkAmazonCountry, setBulkAmazonCountry] = useState('amazon.com');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // Filters & Match Settings
  const [filters, setFilters] = useState({
    keyword: '',
    website: '',
    maxPrice: ''
  });
  const [matchType, setMatchType] = useState('fuzzy'); // 'fuzzy' or 'exact'

  // Helper to determine when to show Amazon Country dropdown
  const showAmazonRegion = formData.website === 'amazon' || formData.website === '' || formData.website === 'allwebsite';

  // --- Handlers ---

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };

  const handleScrape = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResults([]);

    try {
      const response = await api.post('/scrape', formData);

      if (response.data.error) {
        setError(response.data.error);
      } else {
        setResults(response.data.data || []);
        if (response.data.data && response.data.data.length === 0) {
          setError('No products found matching your criteria.');
        }
      }
    } catch (error) {
      console.error('Scrape error:', error);
      setError(error.response?.data?.error || 'Failed to fetch data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // --- File Handling for Bulk Upload ---

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleFileSelection(file);
    }
  }, []);

  const handleFileSelection = (file) => {
    const validTypes = ['.csv', '.xlsx', '.xls'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

    if (!validTypes.includes(fileExtension)) {
      setError('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
      return;
    }
    setSelectedFile(file);
    setError('');
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const removeFile = (e) => {
    if (e) e.stopPropagation();
    setSelectedFile(null);
    // Reset file input value
    const fileInput = document.getElementById('file-upload');
    if (fileInput) fileInput.value = '';
  };

  const handleBulkUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setBulkLoading(true);
    setError('');
    setResults([]);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', selectedFile);
      uploadFormData.append('amazon_country', bulkAmazonCountry || 'amazon.com');

      console.log('🟡 Sending bulk upload with Amazon domain:', bulkAmazonCountry);

      const response = await api.post('/scrape', uploadFormData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 300000 // 5 minute timeout
      });

      if (response.data.error) {
        setError(response.data.error);
      } else {
        setResults(response.data.data || []);
        setSelectedFile(null);
        if (response.data.data && response.data.data.length === 0) {
          setError('No products found in the uploaded file');
        }
      }
    } catch (error) {
      console.error('Bulk upload error:', error);
      setError(error.response?.data?.error || 'Bulk upload failed. Please check your file format and try again.');
    } finally {
      setBulkLoading(false);
    }
  };

  // --- Export & Filtering ---

  const exportToCSV = () => {
    const headers = [
      'BRAND', 'PRODUCT', 'OEM NUMBER', 'ASIN NUMBER', 'WEBSITE',
      'PRODUCT NAME', 'PRICE', 'CURRENCY', 'SELLER RATING',
      'DATE SCRAPED', 'SOURCE URL'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredResults.map(row =>
        headers.map(header =>
          `"${(row[header] || '').toString().replace(/"/g, '""')}"`
        ).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `scrape_results_${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredResults = useMemo(() => {
    return results.filter(item => {
      // 1. Keyword Filter
      const searchTerm = filters.keyword.toLowerCase();
      const matchesKeyword =
        (item.BRAND?.toLowerCase() || '').includes(searchTerm) ||
        (item.PRODUCT?.toLowerCase() || '').includes(searchTerm) ||
        (item['PRODUCT NAME']?.toLowerCase() || '').includes(searchTerm);

      // 2. Website Filter
      const matchesWebsite = filters.website === '' ||
        (item.WEBSITE?.toLowerCase() === filters.website.toLowerCase());

      // 3. Price Filter
      let priceValue = parseFloat((item.PRICE || '0').toString().replace(/[^0-9.]/g, ''));
      if (isNaN(priceValue)) priceValue = 0;
      const maxPrice = parseFloat(filters.maxPrice);
      const matchesPrice = !filters.maxPrice || priceValue <= maxPrice;

      // 4. Exact Match vs Fuzzy Logic
      let matchesType = true;
      if (formData.website !== 'shopify' && matchType === 'exact') {
        const productName = (item['PRODUCT NAME'] || '').toLowerCase();
        const brandQuery = (item.BRAND || '').toLowerCase();
        const productQuery = (item.PRODUCT || '').toLowerCase();

        const brandWords = brandQuery.split(/\s+/).filter(w => w);
        const productWords = productQuery.split(/\s+/).filter(w => w);

        const hasBrand = brandWords.every(word => productName.includes(word));
        const hasProduct = productWords.every(word => productName.includes(word));

        matchesType = hasBrand && hasProduct;
      }

      return matchesKeyword && matchesWebsite && matchesPrice && matchesType;
    });
  }, [results, filters, matchType, formData.website]);

  return (
    <div className="premium-dashboard">
      {/* Header Section */}
      <div className="dashboard-hero">
        <div className="hero-content">
          <h1 className="hero-title">
            Product Intelligence Dashboard
          </h1>
          <p className="hero-subtitle">
            Advanced real-time scraping and competitive analysis
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-content">
        <div className="content-grid">
          {/* Manual Entry Card */}
          <div className="feature-card">
            <div className="card-header">
              <h3 className="card-title">Single Product Search</h3>
              <p className="card-description">Search for individual products across multiple platforms</p>
            </div>

            <div className="card-body">
              <form onSubmit={handleScrape} className="premium-form">
                
                {/* Brand Field */}
                <div className="form-group">
                  <label className="form-label">
                    <span>Brand</span>
                    <span className="required">*</span>
                  </label>
                  <div className="input-wrapper">
                    <input
                      type="text"
                      name="brand"
                      className="form-input"
                      placeholder="e.g., Samsung, Apple, Sony"
                      value={formData.brand}
                      onChange={handleChange}
                      required={formData.website !== 'shopify'} 
                    />
                    <div className="input-icon">
                      <i className="bi bi-tag"></i>
                    </div>
                  </div>
                </div>

                {/* Product Field */}
                {formData.website !== 'shopify' && (
                  <div className="form-group">
                    <label className="form-label">
                      <span>Product</span>
                      <span className="required">*</span>
                    </label>
                    <div className="input-wrapper">
                      <input
                        type="text"
                        name="product"
                        className="form-input"
                        placeholder="e.g., Smart TV, iPhone, Headphones"
                        value={formData.product}
                        onChange={handleChange}
                        required
                      />
                      <div className="input-icon">
                        <i className="bi bi-box"></i>
                      </div>
                    </div>
                  </div>
                )}

                {/* Optional Fields (OEM/ASIN) */}
                {formData.website !== 'shopify' && (
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">OEM Number</label>
                      <div className="input-wrapper">
                        <input
                          type="text"
                          name="oem_number"
                          className="form-input"
                          placeholder="OEM12345"
                          value={formData.oem_number}
                          onChange={handleChange}
                        />
                        <div className="input-icon">
                          <i className="bi bi-upc-scan"></i>
                        </div>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">ASIN Number</label>
                      <div className="input-wrapper">
                        <input
                          type="text"
                          name="asin_number"
                          className="form-input"
                          placeholder="B0CXYZ123"
                          value={formData.asin_number}
                          onChange={handleChange}
                        />
                        <div className="input-icon">
                          <i className="bi bi-upc"></i>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Website Selector */}
                <div className="form-group">
                  <label className="form-label">Website</label>
                  <div className="input-wrapper">
                    <div className="input-icon">
                      <i className="bi bi-globe"></i>
                    </div>
                    <select
                      name="website"
                      className="form-select"
                      value={formData.website}
                      onChange={handleChange}
                    >
                      <option value="">All Websites</option>
                      <option value="amazon">Amazon</option>
                      <option value="flipkart">Flipkart</option>
                      <option value="ebay">eBay</option>
                      <option value="snapdeal">Snapdeal</option>
                      <option value="amitretail">Amit Retail</option>
                      <option value="noon">Noon</option>
                      <option value="sharafdg">Sharaf DG</option>
                      <option value="ntsuae">NTS UAE</option>
                      <option value="seazoneuae">Seazone UAE</option>
                      <option value="empiremarine">Empire Marine</option>
                      <option value="climaxmarine">Climax Marine</option>
                      <option value="shopify" style={{ fontWeight: 'bold', color: '#28a745' }}>
                        ★ Shopify Store Scanner
                      </option>
                    </select>
                  </div>
                </div>

                {/* Shopify Specific URL Field */}
                {formData.website === 'shopify' && (
                  <div className="form-group">
                    <label className="form-label">
                      <span>Store URL</span>
                      <span className="required">*</span>
                    </label>
                    <div className="input-wrapper">
                      <input
                        type="text"
                        name="store_url"
                        className="form-input"
                        placeholder="e.g. gymshark.com, colourpop.com"
                        value={formData.store_url}
                        onChange={handleChange}
                        required
                      />
                      <div className="input-icon">
                        <i className="bi bi-link-45deg"></i>
                      </div>
                    </div>
                    <small className="form-help">
                      Enter the home page URL of the Shopify store to scan all products.
                    </small>
                  </div>
                )}

                {/* Amazon Region Field */}
                {showAmazonRegion && (
                  <div className="form-group">
                    <label className="form-label">Amazon Region</label>
                    <div className="input-wrapper">
                      <div className="input-icon">
                        <i className="bi bi-geo-alt"></i>
                      </div>
                      <select
                        name="amazon_country"
                        className="form-select"
                        value={formData.amazon_country}
                        onChange={handleChange}
                      >
                        <option value="amazon.com">Amazon US (.com)</option>
                        <option value="amazon.in">Amazon India (.in)</option>
                        <option value="amazon.co.uk">Amazon UK (.co.uk)</option>
                        <option value="amazon.ae">Amazon UAE (.ae)</option>
                        <option value="amazon.sa">Amazon KSA (.sa)</option>
                        <option value="amazon.ca">Amazon Canada (.ca)</option>
                        <option value="amazon.de">Amazon Germany (.de)</option>
                        <option value="amazon.fr">Amazon France (.fr)</option>
                        <option value="amazon.it">Amazon Italy (.it)</option>
                        <option value="amazon.es">Amazon Spain (.es)</option>
                        <option value="amazon.com.au">Amazon Australia (.com.au)</option>
                      </select>
                    </div>
                    <small className="form-help">
                      Select which Amazon country you want to scrape.
                    </small>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="btn-spinner"></div>
                      Processing Request...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-search"></i>
                      Start Analysis
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Bulk Upload Card */}
          <div className="feature-card">
            <div className="card-header">
              <h3 className="card-title">Bulk Product Analysis</h3>
              <p className="card-description">Upload multiple products at once for comprehensive comparison</p>
            </div>

            <div className="card-body">
              <div
                className={`upload-zone ${dragActive ? 'drag-active' : ''} ${selectedFile ? 'has-file' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-upload').click()}
              >
                <input
                  id="file-upload"
                  type="file"
                  className="file-input"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileInput}
                />

                {selectedFile ? (
                  <div className="file-preview">
                    <div className="file-icon success">
                      <i className="bi bi-file-earmark-excel"></i>
                    </div>
                    <div className="file-info">
                      <div className="file-name">{selectedFile.name}</div>
                      <div className="file-size">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                    <button
                      className="file-remove"
                      onClick={removeFile}
                    >
                      <i className="bi bi-x"></i>
                    </button>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <div className="upload-icon">
                      <i className="bi bi-cloud-upload"></i>
                    </div>
                    <p className="upload-text">Drag & drop your file here</p>
                    <p className="upload-subtext">Supports CSV, Excel (.xlsx, .xls)</p>
                  </div>
                )}
              </div>

              {/* Amazon Region for Bulk Upload */}
              <div className="form-group">
                <label className="form-label">Amazon Region</label>
                <div className="input-wrapper">
                  <div className="input-icon">
                    <i className="bi bi-geo-alt"></i>
                  </div>
                  <select
                    className="form-select"
                    value={bulkAmazonCountry}
                    onChange={(e) => setBulkAmazonCountry(e.target.value)}
                  >
                    <option value="amazon.com">Amazon US (.com)</option>
                    <option value="amazon.in">Amazon India (.in)</option>
                    <option value="amazon.co.uk">Amazon UK (.co.uk)</option>
                    <option value="amazon.ae">Amazon UAE (.ae)</option>
                    <option value="amazon.sa">Amazon KSA (.sa)</option>
                    <option value="amazon.ca">Amazon Canada (.ca)</option>
                    <option value="amazon.de">Amazon Germany (.de)</option>
                    <option value="amazon.fr">Amazon France (.fr)</option>
                    <option value="amazon.it">Amazon Italy (.it)</option>
                    <option value="amazon.es">Amazon Spain (.es)</option>
                    <option value="amazon.com.au">Amazon Australia (.com.au)</option>
                  </select>
                </div>
                <small className="form-help">
                  Select which Amazon country you want to scrape.
                </small>
              </div>

              <div className="file-requirements">
                <p className="req-title">File Requirements:</p>
                <ul>
                  <li>Must contain columns: Brand, Product</li>
                  <li>Optional: OEM Number, ASIN Number, Website Name</li>
                  <li>Max file size: 5MB</li>
                </ul>
              </div>

              <button
                className="btn btn-success btn-full"
                onClick={handleBulkUpload}
                disabled={!selectedFile || bulkLoading}
              >
                {bulkLoading ? (
                  <>
                    <div className="btn-spinner"></div>
                    Processing Batch...
                  </>
                ) : (
                  <>
                    <i className="bi bi-upload"></i>
                    Upload & Analyze
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-alert">
            <div className="alert-icon">
              <i className="bi bi-exclamation-octagon"></i>
            </div>
            <div className="alert-content">
              <h5 className="alert-title">Operation Failed</h5>
              <p className="alert-message">{error}</p>
            </div>
            <button
              className="alert-close"
              onClick={() => setError('')}
            >
              <i className="bi bi-x"></i>
            </button>
          </div>
        )}

        {/* Results Table Section */}
        {results.length > 0 && (
          <div className="results-section">
            <div className="results-header">
              <div>
                <h3 className="results-title">
                  Comparison Results
                </h3>
                <p className="results-subtitle">
                  Showing {filteredResults.length} (of {results.length}) products
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center' }}>
                {/* Match Type Toggles */}
                {formData.website !== 'shopify' && (
                  <div className="match-toggle-group" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginRight: '20px' }}>
                    <button
                      className={`btn btn-sm ${matchType === 'fuzzy' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setMatchType('fuzzy')}
                      title="Show all related results"
                    >
                      <i className="bi bi-share"></i> Fuzzy Match
                    </button>
                    <button
                      className={`btn btn-sm ${matchType === 'exact' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setMatchType('exact')}
                      title="Show only results containing Brand + Product Name"
                    >
                      <i className="bi bi-check-circle"></i> Exact Match
                    </button>
                  </div>
                )}

                <div className="results-actions">
                  <button
                    className="btn btn-outline"
                    onClick={exportToCSV}
                  >
                    <i className="bi bi-download"></i>
                    Export CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="feature-card filter-card" style={{ marginBottom: '20px', padding: '12px 20px' }}>
              <div className="form-row" style={{ alignItems: 'flex-end', gap: '15px', margin: 0 }}>

                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.85rem', marginBottom: '4px', color: '#666' }}>
                    Keyword
                  </label>
                  <div className="input-wrapper">
                    <input
                      type="text"
                      name="keyword"
                      className="form-input"
                      placeholder="Search brand or product..."
                      value={filters.keyword}
                      onChange={handleFilterChange}
                      style={{ height: '40px', paddingLeft: '35px', fontSize: '0.9rem' }}
                    />
                    <div className="input-icon" style={{ height: '40px', lineHeight: '40px', width: '35px' }}>
                      <i className="bi bi-search" style={{ fontSize: '0.9rem' }}></i>
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.85rem', marginBottom: '4px', color: '#666' }}>
                    Website
                  </label>
                  <div className="input-wrapper">
                    <div className="input-icon" style={{ height: '40px', lineHeight: '40px', width: '35px' }}>
                      <i className="bi bi-funnel" style={{ fontSize: '0.9rem' }}></i>
                    </div>
                    <select
                      name="website"
                      className="form-select"
                      value={filters.website}
                      onChange={handleFilterChange}
                      style={{ height: '40px', paddingLeft: '35px', fontSize: '0.9rem' }}
                    >
                      <option value="">All Websites</option>
                      <option value="amazon">Amazon</option>
                      <option value="flipkart">Flipkart</option>
                      <option value="ebay">eBay</option>
                      <option value="snapdeal">Snapdeal</option>
                      <option value="amitretail">Amit Retail</option>
                      <option value="noon">Noon</option>
                      <option value="sharafdg">Sharaf DG</option>
                      <option value="ntsuae">NTS UAE</option>
                      <option value="seazoneuae">Seazone UAE</option>
                      <option value="empiremarine">Empire Marine</option>
                      <option value="climaxmarine">Climax Marine</option>
                      <option value="shopify">Shopify Store</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.85rem', marginBottom: '4px', color: '#666' }}>
                    Max Price
                  </label>
                  <div className="input-wrapper">
                    <input
                      type="number"
                      name="maxPrice"
                      className="form-input"
                      placeholder="0.00"
                      value={filters.maxPrice}
                      onChange={handleFilterChange}
                      style={{ height: '40px', paddingLeft: '35px', fontSize: '0.9rem' }}
                    />
                    <div className="input-icon" style={{ height: '40px', lineHeight: '40px', width: '35px' }}>
                      <i className="bi bi-cash" style={{ fontSize: '0.9rem' }}></i>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="table-container">
              <div className="table-scroll">
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>Brand</th>
                      <th>Website</th>
                      <th>Product Name</th>
                      <th>Price</th>
                      <th>Currency</th>
                      <th>Seller Rating</th>
                      <th>Date Scraped ({user?.timezone || 'UTC'})</th>
                      <th>Source URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((item, index) => (
                      <tr key={index}>
                        <td>
                          <div className="brand-cell">
                            <span className="brand-text">{item.BRAND}</span>
                            <span className="product-subtext">{item.PRODUCT}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge badge-${item.WEBSITE.toLowerCase().replace(/\s/g, '')}`}>
                            {item.WEBSITE}
                          </span>
                        </td>
                        <td>
                          <div className="product-name-cell" title={item['PRODUCT NAME']}>
                            {item['PRODUCT NAME']}
                          </div>
                        </td>
                        <td>
                          <div className="price-cell">
                            <span
                              className="currency-symbol"
                              style={{
                                color: '#888',
                                fontWeight: 'bold',
                                marginRight: '4px',
                                fontSize: '0.9em'
                              }}
                            >
                              {getFormattedCurrency(item.CURRENCY)}
                            </span>
                            <span className="price-value">
                              {item.PRICE}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="currency">{item.CURRENCY}</span>
                        </td>
                        <td>
                          {item['SELLER RATING'] && item['SELLER RATING'] !== 'N/A' ? (
                            <div className="rating-cell">
                              <i className="bi bi-star-fill text-warning"></i>
                              <span>{item['SELLER RATING']}</span>
                            </div>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td>
                          <span className="date-cell">
                            {formatToAccountTime(item['DATE SCRAPED'], user?.timezone)}
                          </span>
                        </td>
                        <td>
                          <div className="action-cell">
                            <a
                              href={item['SOURCE URL']}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="action-btn view-btn"
                              title="View Product"
                            >
                              <i className="bi bi-box-arrow-up-right"></i>
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {results.length > 0 && filteredResults.length === 0 && (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                    <i className="bi bi-search" style={{ fontSize: '2rem', display: 'block', marginBottom: '10px', opacity: 0.5 }}></i>
                    {matchType === 'exact'
                      ? "No exact matches found. Try switching to 'Fuzzy Match' to see all results."
                      : "No products match your filters."}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <ChatWidget />
      </div>
    </div>
  );
};

export default Dashboard;

// import React, { useState, useCallback, useMemo } from 'react';
// import api from '../utils/apiConfig';
// import { useAuth } from '../contexts/AuthContext';
// import { formatToAccountTime } from '../utils/dateUtils';
// import '../styles/Dashboard.css';
// import '../styles/Table.css';
// import { getFormattedCurrency } from '../utils/currencyUtils';

// const Dashboard = () => {
//   const [formData, setFormData] = useState({
//     brand: '',
//     product: '',
//     oem_number: '',
//     asin_number: '',
//     website: 'amazon',
//     amazon_country: 'amazon.com',
//     store_url: ''
//   });
//   const [bulkAmazonCountry, setBulkAmazonCountry] = useState('amazon.com');

//   const [results, setResults] = useState([]);
//   const [error, setError] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [bulkLoading, setBulkLoading] = useState(false);
//   const [dragActive, setDragActive] = useState(false);
//   const [selectedFile, setSelectedFile] = useState(null);
  
//   const { user } = useAuth();

//   const [filters, setFilters] = useState({
//     keyword: '',
//     website: '',
//     maxPrice: ''
//   });

//   const [matchType, setMatchType] = useState('fuzzy');

//   const showAmazonRegion = formData.website === 'amazon';

//   const handleChange = (e) => {
//     setFormData({
//       ...formData,
//       [e.target.name]: e.target.value
//     });
//   };

//   const handleFilterChange = (e) => {
//     setFilters({
//       ...filters,
//       [e.target.name]: e.target.value
//     });
//   };

//   const handleScrape = async (e) => {
//     e.preventDefault();
//     setLoading(true);
//     setError('');
//     setResults([]);

//     try {
//       const response = await api.post('/scrape', formData);
//       if (response.data.error) {
//         setError(response.data.error);
//       } else {
//         setResults(response.data.data);
//       }
//     } catch (error) {
//       setError(error.response?.data?.error || 'An error occurred during scraping');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleDrag = useCallback((e) => {
//     e.preventDefault();
//     e.stopPropagation();
//     if (e.type === "dragenter" || e.type === "dragover") {
//       setDragActive(true);
//     } else if (e.type === "dragleave") {
//       setDragActive(false);
//     }
//   }, []);

//   const handleDrop = useCallback((e) => {
//     e.preventDefault();
//     e.stopPropagation();
//     setDragActive(false);

//     if (e.dataTransfer.files && e.dataTransfer.files[0]) {
//       const file = e.dataTransfer.files[0];
//       handleFileSelection(file);
//     }
//   }, []);

//   const handleFileInput = (e) => {
//     if (e.target.files && e.target.files[0]) {
//       handleFileSelection(e.target.files[0]);
//     }
//   };

//   const handleFileSelection = (file) => {
//     const validTypes = ['.csv', '.xlsx', '.xls'];
//     const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

//     if (!validTypes.includes(fileExtension)) {
//       setError('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
//       return;
//     }

//     if (file.size > 10 * 1024 * 1024) {
//       setError('File size should be less than 10MB');
//       return;
//     }

//     setSelectedFile(file);
//     setError('');
//   };

//   const handleBulkUpload = async () => {
//     if (!selectedFile) {
//       setError('Please select a file first');
//       return;
//     }

//     setBulkLoading(true);
//     setError('');
//     setResults([]);

//     try {
//       const uploadFormData = new FormData();
//       uploadFormData.append('file', selectedFile);
//       uploadFormData.append('amazon_country', bulkAmazonCountry || 'amazon.com');

//       console.log('🟡 Sending bulk upload with Amazon domain:', bulkAmazonCountry);

//       const response = await api.post('/scrape', uploadFormData, {
//         headers: {
//           'Content-Type': 'multipart/form-data',
//         },
//         timeout: 300000
//       });

//       if (response.data.error) {
//         setError(response.data.error);
//       } else {
//         setResults(response.data.data || []);
//         setSelectedFile(null);
//         if (response.data.data && response.data.data.length === 0) {
//           setError('No products found in the uploaded file');
//         }
//       }
//     } catch (error) {
//       console.error('Bulk upload error:', error);
//       setError(error.response?.data?.error || 'Bulk upload failed. Please check your file format and try again.');
//     } finally {
//       setBulkLoading(false);
//     }
//   };

//   const removeFile = () => {
//     setSelectedFile(null);
//   };

//   const exportToCSV = () => {
//     const headers = [
//       'BRAND', 'PRODUCT', 'OEM NUMBER', 'ASIN NUMBER', 'WEBSITE',
//       'PRODUCT NAME', 'PRICE', 'CURRENCY', 'SELLER RATING',
//       'DATE SCRAPED', 'SOURCE URL'
//     ];

//     const csvContent = [
//       headers.join(','),
//       ...filteredResults.map(row =>
//         headers.map(header =>
//           `"${(row[header] || '').toString().replace(/"/g, '""')}"`
//         ).join(',')
//       )
//     ].join('\n');

//     const blob = new Blob([csvContent], { type: 'text/csv' });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = 'price_comparison_results.csv';
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
//     URL.revokeObjectURL(url);
//   };

//   const filteredResults = useMemo(() => {
//     return results.filter(item => {
//       const searchTerm = filters.keyword.toLowerCase();
//       const matchesKeyword =
//         (item.BRAND?.toLowerCase() || '').includes(searchTerm) ||
//         (item.PRODUCT?.toLowerCase() || '').includes(searchTerm) ||
//         (item['PRODUCT NAME']?.toLowerCase() || '').includes(searchTerm);

//       const matchesWebsite = filters.website === '' ||
//         (item.WEBSITE?.toLowerCase() === filters.website.toLowerCase());

//       let priceValue = parseFloat((item.PRICE || '0').toString().replace(/[^0-9.]/g, ''));
//       if (isNaN(priceValue)) priceValue = 0;

//       const maxPrice = parseFloat(filters.maxPrice);
//       const matchesPrice = !filters.maxPrice || priceValue <= maxPrice;

//       let matchesType = true;
//       if (formData.website !== 'shopify' && matchType === 'exact') {
//         const productName = (item['PRODUCT NAME'] || '').toLowerCase();
//         const brandQuery = (item.BRAND || '').toLowerCase();
//         const productQuery = (item.PRODUCT || '').toLowerCase();

//         const brandWords = brandQuery.split(/\s+/).filter(w => w);
//         const productWords = productQuery.split(/\s+/).filter(w => w);

//         const hasBrand = brandWords.every(word => productName.includes(word));
//         const hasProduct = productWords.every(word => productName.includes(word));

//         matchesType = hasBrand && hasProduct;
//       }

//       return matchesKeyword && matchesWebsite && matchesPrice && matchesType;
//     });
//   }, [results, filters, matchType, formData.website]);

//   return (
//     <div className="premium-dashboard">
//       <div className="dashboard-hero">
//         <div className="hero-content">
//           <h1 className="hero-title">
//             Intelligent Price Comparison
//           </h1>
//           <p className="hero-subtitle">
//             Compare product prices across multiple e-commerce platforms with AI-powered insights
//           </p>
//           <div className="hero-stats">
//             <div className="stat-item">
//               <div className="stat-number">10+</div>
//               <div className="stat-label">Websites</div>
//             </div>
//             <div className="stat-item">
//               <div className="stat-number">100+</div>
//               <div className="stat-label">Products</div>
//             </div>
//             <div className="stat-item">
//               <div className="stat-number">99.8%</div>
//               <div className="stat-label">Accuracy</div>
//             </div>
//           </div>
//         </div>
//       </div>

//       <div className="dashboard-content">
//         <div className="content-grid">
//           <div className="feature-card">
//             <div className="card-header">
//               <h3 className="card-title">Single Product Search</h3>
//               <p className="card-description">Search for individual products across multiple platforms</p>
//             </div>

//             <div className="card-body">
//               <form onSubmit={handleScrape} className="premium-form">
                
//                 <div className="form-group">
//                   <label className="form-label">Website</label>
//                   <div className="input-wrapper">
//                     <div className="input-icon">
//                       <i className="bi bi-globe"></i>
//                     </div>
//                     <select
//                       name="website"
//                       className="form-select"
//                       value={formData.website}
//                       onChange={handleChange}
//                     >
//                       <option value="amazon">Amazon</option>
//                       <option value="flipkart">Flipkart</option>
//                       <option value="ebay">eBay</option>
//                       <option value="snapdeal">Snapdeal</option>
//                       <option value="amitretail">Amit Retail</option>
//                       <option value="noon">Noon</option>
//                       <option value="sharafdg">Sharaf DG</option>
//                       <option value="ntsuae">NTS UAE</option>
//                       <option value="seazoneuae">Seazone UAE</option>
//                       <option value="empiremarine">Empire Marine</option>
//                       <option value="climaxmarine">Climax Marine</option>
//                       <option value="shopify" style={{ fontWeight: 'bold', color: '#28a745' }}>
//                         ★ Shopify Store Scanner
//                       </option>
//                     </select>
//                   </div>
//                 </div>

//                 {formData.website === 'shopify' ? (
//                   <div className="form-group">
//                     <label className="form-label">
//                       <span>Store URL</span>
//                       <span className="required">*</span>
//                     </label>
//                     <div className="input-wrapper">
//                       <input
//                         type="text"
//                         name="store_url"
//                         className="form-input"
//                         placeholder="e.g. gymshark.com, colourpop.com"
//                         value={formData.store_url}
//                         onChange={handleChange}
//                         required
//                       />
//                       <div className="input-icon">
//                         <i className="bi bi-link-45deg"></i>
//                       </div>
//                     </div>
//                     <small className="form-help">
//                       Enter the home page URL of the Shopify store to scan all products.
//                     </small>
//                   </div>
//                 ) : (
//                   <>
//                     <div className="form-group">
//                       <label className="form-label">
//                         <span>Brand</span>
//                         <span className="required">*</span>
//                       </label>
//                       <div className="input-wrapper">
//                         <input
//                           type="text"
//                           name="brand"
//                           className="form-input"
//                           placeholder="e.g., Samsung, Apple, Sony"
//                           value={formData.brand}
//                           onChange={handleChange}
//                           required
//                         />
//                         <div className="input-icon">
//                           <i className="bi bi-tag"></i>
//                         </div>
//                       </div>
//                     </div>

//                     <div className="form-group">
//                       <label className="form-label">
//                         <span>Product</span>
//                         <span className="required">*</span>
//                       </label>
//                       <div className="input-wrapper">
//                         <input
//                           type="text"
//                           name="product"
//                           className="form-input"
//                           placeholder="e.g., Smart TV, iPhone, Headphones"
//                           value={formData.product}
//                           onChange={handleChange}
//                           required
//                         />
//                         <div className="input-icon">
//                           <i className="bi bi-box"></i>
//                         </div>
//                       </div>
//                     </div>

//                     <div className="form-row">
//                       <div className="form-group">
//                         <label className="form-label">OEM Number</label>
//                         <div className="input-wrapper">
//                           <input
//                             type="text"
//                             name="oem_number"
//                             className="form-input"
//                             placeholder="OEM12345"
//                             value={formData.oem_number}
//                             onChange={handleChange}
//                           />
//                           <div className="input-icon">
//                             <i className="bi bi-upc-scan"></i>
//                           </div>
//                         </div>
//                       </div>

//                       <div className="form-group">
//                         <label className="form-label">ASIN Number</label>
//                         <div className="input-wrapper">
//                           <input
//                             type="text"
//                             name="asin_number"
//                             className="form-input"
//                             placeholder="B0CXYZ123"
//                             value={formData.asin_number}
//                             onChange={handleChange}
//                           />
//                           <div className="input-icon">
//                             <i className="bi bi-upc"></i>
//                           </div>
//                         </div>
//                       </div>
//                     </div>
//                   </>
//                 )}

//                 {showAmazonRegion && (
//                   <div className="form-group">
//                     <label className="form-label">Amazon Region</label>
//                     <div className="input-wrapper">
//                       <div className="input-icon">
//                         <i className="bi bi-globe-americas"></i>
//                       </div>
//                       <select
//                         name="amazon_country"
//                         className="form-select"
//                         value={formData.amazon_country}
//                         onChange={handleChange}
//                       >
//                         <option value="amazon.com">Amazon.com (US)</option>
//                         <option value="amazon.co.uk">Amazon UK</option>
//                         <option value="amazon.in">Amazon India</option>
//                         <option value="amazon.ae">Amazon UAE</option>
//                         <option value="amazon.de">Amazon Germany</option>
//                         <option value="amazon.fr">Amazon France</option>
//                         <option value="amazon.it">Amazon Italy</option>
//                         <option value="amazon.es">Amazon Spain</option>
//                         <option value="amazon.ca">Amazon Canada</option>
//                         <option value="amazon.com.au">Amazon Australia</option>
//                         <option value="amazon.sg">Amazon Singapore</option>
//                         <option value="amazon.sa">Amazon Saudi Arabia</option>
//                         <option value="amazon.nl">Amazon Netherlands</option>
//                         <option value="amazon.pl">Amazon Poland</option>
//                         <option value="amazon.se">Amazon Sweden</option>
//                         <option value="amazon.co.jp">Amazon Japan</option>
//                         <option value="amazon.com.br">Amazon Brazil</option>
//                         <option value="amazon.com.mx">Amazon Mexico</option>
//                       </select>
//                     </div>
//                     <small className="form-help">
//                       Select which Amazon country you want to scrape
//                     </small>
//                   </div>
//                 )}

//                 <button
//                   type="submit"
//                   className="btn btn-primary btn-full"
//                   disabled={loading}
//                 >
//                   {loading ? (
//                     <>
//                       <div className="btn-spinner"></div>
//                       Searching Products...
//                     </>
//                   ) : (
//                     <>
//                       Start Price Comparison
//                     </>
//                   )}
//                 </button>
//               </form>
//             </div>
//           </div>

//           <div className="feature-card">
//             <div className="card-header">
//               <h3 className="card-title">Bulk Product Analysis</h3>
//               <p className="card-description">Upload multiple products at once for comprehensive comparison</p>
//             </div>

//             <div className="card-body">
//               <div
//                 className={`upload-zone ${dragActive ? 'drag-active' : ''} ${selectedFile ? 'has-file' : ''}`}
//                 onDragEnter={handleDrag}
//                 onDragLeave={handleDrag}
//                 onDragOver={handleDrag}
//                 onDrop={handleDrop}
//                 onClick={() => document.getElementById('fileInput').click()}
//               >
//                 <input
//                   type="file"
//                   id="fileInput"
//                   className="d-none"
//                   accept=".csv,.xlsx,.xls"
//                   onChange={handleFileInput}
//                 />

//                 {selectedFile ? (
//                   <div className="file-preview">
//                     <div className="file-icon success">
//                       <i className="bi bi-file-earmark-check"></i>
//                     </div>
//                     <div className="file-info">
//                       <div className="file-name">{selectedFile.name}</div>
//                       <div className="file-size">
//                         {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
//                       </div>
//                     </div>
//                     <button
//                       className="file-remove"
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         removeFile();
//                       }}
//                     >
//                       <i className="bi bi-x"></i>
//                     </button>
//                   </div>
//                 ) : (
//                   <div className="upload-content">
//                     <div className="upload-icon">
//                       <i className="bi bi-cloud-arrow-up"></i>
//                     </div>
//                     <h4 className="upload-title">Drag & Drop Your File</h4>
//                     <p className="upload-description">
//                       Supported formats: CSV, Excel (.csv, .xlsx, .xls)
//                     </p>
//                     <p className="upload-note">Maximum file size: 10MB</p>
//                     <button className="btn btn-outline btn-sm">
//                       <i className="bi bi-folder2-open"></i>
//                       Browse Files
//                     </button>
//                   </div>
//                 )}
//               </div>

//               <div className="form-group">
//                 <label className="form-label">Amazon Region</label>
//                 <div className="input-wrapper">
//                   <div className="input-icon">
//                     <i className="bi bi-globe-americas"></i>
//                   </div>
//                   <select
//                     name="amazon_country"
//                     className="form-select"
//                     value={bulkAmazonCountry}
//                     onChange={(e) => setBulkAmazonCountry(e.target.value)}
//                   >
//                     <option value="amazon.com">Amazon.com (US)</option>
//                     <option value="amazon.co.uk">Amazon UK</option>
//                     <option value="amazon.in">Amazon India</option>
//                     <option value="amazon.ae">Amazon UAE</option>
//                     <option value="amazon.de">Amazon Germany</option>
//                     <option value="amazon.fr">Amazon France</option>
//                     <option value="amazon.it">Amazon Italy</option>
//                     <option value="amazon.es">Amazon Spain</option>
//                     <option value="amazon.ca">Amazon Canada</option>
//                     <option value="amazon.com.au">Amazon Australia</option>
//                     <option value="amazon.sg">Amazon Singapore</option>
//                     <option value="amazon.sa">Amazon Saudi Arabia</option>
//                     <option value="amazon.nl">Amazon Netherlands</option>
//                     <option value="amazon.pl">Amazon Poland</option>
//                     <option value="amazon.se">Amazon Sweden</option>
//                     <option value="amazon.co.jp">Amazon Japan</option>
//                     <option value="amazon.com.br">Amazon Brazil</option>
//                     <option value="amazon.com.mx">Amazon Mexico</option>
//                   </select>
//                 </div>
//                 <small className="form-help">
//                   Select which Amazon country you want to scrape
//                 </small>
//               </div>

//               <div className="upload-guide">
//                 <h5 className="guide-title">File Format Requirements:</h5>
//                 <ul className="guide-list">
//                   <li>Include columns: <strong>Brand, Product, Website Name</strong></li>
//                   <li>Optional columns: <strong>OEM Number, ASIN Number</strong></li>
//                   <li>First row should contain headers</li>
//                   <li>Supported formats: CSV, XLSX, XLS</li>
//                 </ul>
//               </div>

//               <button
//                 className="btn btn-success btn-full"
//                 onClick={handleBulkUpload}
//                 disabled={!selectedFile || bulkLoading}
//               >
//                 {bulkLoading ? (
//                   <>
//                     <div className="btn-spinner"></div>
//                     Processing Bulk Upload...
//                   </>
//                 ) : (
//                   <>
//                     Analyze Multiple Products
//                   </>
//                 )}
//               </button>
//             </div>
//           </div>
//         </div>

//         {error && (
//           <div className="error-alert">
//             <div className="alert-icon">
//               <i className="bi bi-exclamation-triangle"></i>
//             </div>
//             <div className="alert-content">
//               <h5 className="alert-title">Operation Failed</h5>
//               <p className="alert-message">{error}</p>
//             </div>
//             <button
//               className="alert-close"
//               onClick={() => setError('')}
//             >
//               <i className="bi bi-x"></i>
//             </button>
//           </div>
//         )}

//         {results.length > 0 && (
//           <div className="results-section">
//             <div className="results-header">
//               <div className="results-info">
//                 <h3 className="results-title">
//                   <i className="bi bi-table"></i>
//                   Comparison Results
//                 </h3>
//                 <p className="results-subtitle">
//                   Showing {filteredResults.length} (of {results.length}) products
//                 </p>
//               </div>

//               {formData.website !== 'shopify' && (
//                 <div className="match-toggle-group" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginRight: '20px' }}>
//                   <button
//                     className={`btn btn-sm ${matchType === 'fuzzy' ? 'btn-primary' : 'btn-outline'}`}
//                     onClick={() => setMatchType('fuzzy')}
//                     title="Show all related results (includes accessories/similar items)"
//                   >
//                     <i className="bi bi-share"></i> Fuzzy Match
//                   </button>
//                   <button
//                     className={`btn btn-sm ${matchType === 'exact' ? 'btn-primary' : 'btn-outline'}`}
//                     onClick={() => setMatchType('exact')}
//                     title="Show only results that contain Brand + Product Name"
//                   >
//                     <i className="bi bi-check-circle"></i> Exact Match
//                   </button>
//                 </div>
//               )}

//               <div className="results-actions">
//                 <button
//                   className="btn btn-outline"
//                   onClick={exportToCSV}
//                 >
//                   <i className="bi bi-download"></i>
//                   Export CSV
//                 </button>
//               </div>
//             </div>

//             <div className="feature-card filter-card" style={{ marginBottom: '20px', padding: '12px 20px' }}>
//               <div className="form-row" style={{ alignItems: 'flex-end', gap: '15px', margin: 0 }}>

//                 <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
//                   <label className="form-label" style={{ fontSize: '0.85rem', marginBottom: '4px', color: '#666' }}>
//                     Keyword
//                   </label>
//                   <div className="input-wrapper">
//                     <input
//                       type="text"
//                       name="keyword"
//                       className="form-input"
//                       placeholder="Search brand or product..."
//                       value={filters.keyword}
//                       onChange={handleFilterChange}
//                       style={{ height: '40px', paddingLeft: '35px', fontSize: '0.9rem' }}
//                     />
//                     <div className="input-icon" style={{ height: '40px', lineHeight: '40px', width: '35px' }}>
//                       <i className="bi bi-search" style={{ fontSize: '0.9rem' }}></i>
//                     </div>
//                   </div>
//                 </div>

//                 <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
//                   <label className="form-label" style={{ fontSize: '0.85rem', marginBottom: '4px', color: '#666' }}>
//                     Website
//                   </label>
//                   <div className="input-wrapper">
//                     <div className="input-icon" style={{ height: '40px', lineHeight: '40px', width: '35px' }}>
//                       <i className="bi bi-funnel" style={{ fontSize: '0.9rem' }}></i>
//                     </div>
//                     <select
//                       name="website"
//                       className="form-select"
//                       value={filters.website}
//                       onChange={handleFilterChange}
//                       style={{ height: '40px', paddingLeft: '35px', fontSize: '0.9rem' }}
//                     >
//                       <option value="">All Websites</option>
//                       <option value="amazon">Amazon</option>
//                       <option value="flipkart">Flipkart</option>
//                       <option value="ebay">eBay</option>
//                       <option value="snapdeal">Snapdeal</option>
//                       <option value="amitretail">Amit Retail</option>
//                       <option value="noon">Noon</option>
//                       <option value="sharafdg">Sharaf DG</option>
//                       <option value="ntsuae">NTS UAE</option>
//                       <option value="seazoneuae">Seazone UAE</option>
//                       <option value="empiremarine">Empire Marine</option>
//                       <option value="climaxmarine">Climax Marine</option>
//                       <option value="shopify">Shopify Store</option>
//                     </select>
//                   </div>
//                 </div>

//                 <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
//                   <label className="form-label" style={{ fontSize: '0.85rem', marginBottom: '4px', color: '#666' }}>
//                     Max Price
//                   </label>
//                   <div className="input-wrapper">
//                     <input
//                       type="number"
//                       name="maxPrice"
//                       className="form-input"
//                       placeholder="0.00"
//                       value={filters.maxPrice}
//                       onChange={handleFilterChange}
//                       style={{ height: '40px', paddingLeft: '35px', fontSize: '0.9rem' }}
//                     />
//                     <div className="input-icon" style={{ height: '40px', lineHeight: '40px', width: '35px' }}>
//                       <i className="bi bi-cash" style={{ fontSize: '0.9rem' }}></i>
//                     </div>
//                   </div>
//                 </div>

//               </div>
//             </div>

//             <div className="table-container">
//               <div className="table-scroll">
//                 <table className="premium-table">
//                   <thead>
//                     <tr>
//                       <th>Brand</th>
//                       <th>Product</th>
//                       <th>OEM Number</th>
//                       <th>ASIN Number</th>
//                       <th>Website</th>
//                       <th>Product Name</th>
//                       <th>Price</th>
//                       <th>Seller Rating</th>
//                       <th>Date Scraped ({user?.timezone || 'UTC'})</th>
//                       <th>Source URL</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {filteredResults.map((item, index) => (
//                       <tr key={index}>
//                         <td>
//                           <div className="brand-cell">
//                             <div className="brand-avatar">
//                               {item.BRAND?.charAt(0)?.toUpperCase() || 'N/A'}
//                             </div>
//                             <span>{item.BRAND}</span>
//                           </div>
//                         </td>
//                         <td>
//                           <span className="product-name">{item.PRODUCT}</span>
//                         </td>
//                         <td>
//                           <code className="code-cell">{item['OEM NUMBER'] || '-'}</code>
//                         </td>
//                         <td>
//                           <code className="code-cell">{item['ASIN NUMBER'] || '-'}</code>
//                         </td>
//                         <td>
//                           <span className={`platform-badge platform-${item.WEBSITE?.toLowerCase()}`}>
//                             {item.WEBSITE}
//                           </span>
//                         </td>
//                         <td>
//                           <div className="product-title">
//                             {item['PRODUCT NAME']}
//                           </div>
//                         </td>
//                         <td>
//                           <div className="price-cell">
//                             <span 
//                               className="currency-symbol" 
//                               style={{ 
//                                 color: '#888', 
//                                 fontWeight: 'bold', 
//                                 marginRight: '4px',
//                                 fontSize: '0.9em' 
//                               }}
//                             >
//                               {getFormattedCurrency(item.CURRENCY)}
//                             </span>
                            
//                             <span className="price-value">
//                               {item.PRICE}
//                             </span>
//                           </div>
//                         </td>
//                         <td>
//                           {item['SELLER RATING'] && item['SELLER RATING'] !== 'N/A' ? (
//                             <div className="rating-cell">
//                               <div className="rating-stars">
//                                 <i className="bi bi-star-fill"></i>
//                                 <span>{item['SELLER RATING']}</span>
//                               </div>
//                             </div>
//                           ) : (
//                             <span className="no-rating">-</span>
//                           )}
//                         </td>
//                         <td>
//                           <span className="date-cell">
//                             {formatToAccountTime(item['DATE SCRAPED'], user?.timezone)}
//                           </span>
//                         </td>
//                         <td>
//                           <div className="action-cell">
//                             <a
//                               href={item['SOURCE URL']}
//                               target="_blank"
//                               rel="noopener noreferrer"
//                               className="action-btn view-btn"
//                               title="View Product"
//                             >
//                               <i className="bi bi-eye"></i>
//                             </a>
//                           </div>
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//                 {results.length > 0 && filteredResults.length === 0 && (
//                   <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
//                     <i className="bi bi-search" style={{ fontSize: '2rem', display: 'block', marginBottom: '10px', opacity: 0.5 }}></i>
//                     {matchType === 'exact'
//                       ? "No exact matches found. Try switching to 'Fuzzy Match' to see all results."
//                       : "No products match your filters."}
//                   </div>
//                 )}
//               </div>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default Dashboard;

// };

// export default Dashboard;
