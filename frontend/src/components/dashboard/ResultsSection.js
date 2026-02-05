import React, { useMemo } from 'react';
import { formatToAccountTime } from '../../utils/dateUtils';
import { getFormattedCurrency } from '../../utils/currencyUtils';
import '../../styles/ResultSection.css';
import '../../styles/Dashboard.css';

const ResultsSection = ({
  results,
  filteredResults,
  filters,
  formData,
  matchType,
  user,
  onFilterChange,
  onMatchTypeChange,
  onExportCSV,
  onErrorClear
}) => {
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

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'price_comparison_results.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Get website icon
  const getWebsiteIcon = (website) => {
    switch(website?.toLowerCase()) {
      case 'amazon': return 'bi-amazon';
      case 'ebay': return 'bi-cart';
      case 'flipkart': return 'bi-shop';
      case 'shopify': return 'bi-cart4';
      default: return 'bi-globe';
    }
  };

  // Format price with currency
  const formatPrice = (price, currency) => {
    if (!price || price === 'N/A') return 'N/A';
    return `${getFormattedCurrency(currency)}${price}`;
  };

  return (
    <div className="results-section">
      <div className="results-header">
        <div className="results-info">
          <h3 className="results-title">
            Comparison Results
          </h3>
          <p className="results-subtitle">
            Showing {filteredResults.length} of {results.length} products
          </p>
        </div>

        <div className="results-controls">
          {formData.website !== 'shopify' && (
            <div className="match-toggle">
              <button
                className={`match-btn ${matchType === 'fuzzy' ? 'active' : ''}`}
                onClick={() => onMatchTypeChange('fuzzy')}
                title="Show all related results"
              >
                Fuzzy Match
              </button>
              <button
                className={`match-btn ${matchType === 'exact' ? 'active' : ''}`}
                onClick={() => onMatchTypeChange('exact')}
                title="Show only results that contain Brand + Product Name"
              >
                Exact Match
              </button>
            </div>
          )}

          <div className="results-actions">
            <button 
              className="export-btn"
              onClick={onExportCSV || exportToCSV}
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="filters-bar">
        <div className="filter-group">
          <div className="filter-input">
            <i className="bi bi-search"></i>
            <input
              type="text"
              name="keyword"
              placeholder="Search products..."
              value={filters.keyword}
              onChange={onFilterChange}
            />
          </div>
        </div>

        <div className="filter-group">
          <div className="filter-select">
            <i className="bi bi-funnel"></i>
            <select
              name="website"
              value={filters.website}
              onChange={onFilterChange}
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
              <option value="shopify">Shopify</option>
            </select>
          </div>
        </div>

        <div className="filter-group">
          <div className="filter-input">
            <i className="bi bi-currency-dollar"></i>
            <input
              type="number"
              name="maxPrice"
              placeholder="Max price"
              value={filters.maxPrice}
              onChange={onFilterChange}
            />
          </div>
        </div>
      </div>

      {/* Results Grid - Card View */}
      {filteredResults.length > 0 ? (
        <div className="results-grid">
          {filteredResults.map((item, index) => (
            <div key={index} className="product-card">
              <div className="card-header">
                <div className="website-badge">
                  <i className={`bi ${getWebsiteIcon(item.WEBSITE)}`}></i>
                  <span>{item.WEBSITE}</span>
                </div>
                <div className="product-brand">
                  <span className="brand-name">{item.BRAND || 'Unknown Brand'}</span>
                </div>
              </div>

              <div className="card-body">
                <h4 className="product-title">{item['PRODUCT NAME'] || item.PRODUCT}</h4>
                
                <div className="product-meta">
                  {item.PRODUCT && (
                    <div className="meta-item">
                      <span className="meta-label">Product</span>
                      <span className="meta-value">{item.PRODUCT}</span>
                    </div>
                  )}
                  
                  {item['OEM NUMBER'] && item['OEM NUMBER'] !== 'N/A' && (
                    <div className="meta-item">
                      <span className="meta-label">OEM</span>
                      <span className="meta-value">{item['OEM NUMBER']}</span>
                    </div>
                  )}
                  
                  {item['ASIN NUMBER'] && item['ASIN NUMBER'] !== 'N/A' && (
                    <div className="meta-item">
                      <span className="meta-label">ASIN</span>
                      <span className="meta-value">{item['ASIN NUMBER']}</span>
                    </div>
                  )}
                </div>

                <div className="product-price">
                  <div className="price-main">
                    <span className="price-amount">{formatPrice(item.PRICE, item.CURRENCY)}</span>
                    {item.CURRENCY && item.CURRENCY !== 'N/A' && (
                      <span className="price-currency">{item.CURRENCY}</span>
                    )}
                  </div>
                  
                  {item['SELLER RATING'] && item['SELLER RATING'] !== 'N/A' && (
                    <div className="product-rating">
                      <i className="bi bi-star-fill"></i>
                      <span>{item['SELLER RATING']}</span>
                    </div>
                  )}
                </div>

                <div className="product-footer">
                  <div className="scraped-time">
                    <i className="bi bi-clock"></i>
                    <span>{formatToAccountTime(item['DATE SCRAPED'], user?.timezone)}</span>
                  </div>
                  
                  <a 
                    href={item['SOURCE URL']} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="view-link"
                  >
                    View Product
                    <i className="bi bi-arrow-right"></i>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="no-results">
          <i className="bi bi-search"></i>
          {matchType === 'exact'
            ? "No exact matches found. Try switching to 'Fuzzy Match' to see all results."
            : "No products match your filters."}
        </div>
      ) : null}
    </div>
  );
};

export default ResultsSection;