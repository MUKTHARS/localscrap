import React, { useState } from 'react';
import '../../styles/ProductSearchCard.css';

const ProductSearchCard = ({ 
  formData, 
  onFormChange, 
  onScrape, 
  loading 
}) => {
  const [localFormData, setLocalFormData] = useState(formData);

  const handleChange = (e) => {
    const newData = {
      ...localFormData,
      [e.target.name]: e.target.value
    };
    setLocalFormData(newData);
    onFormChange(newData);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onScrape(localFormData);
  };

  const showAmazonRegion = localFormData.website === 'amazon' || 
                         localFormData.website === '' || 
                         localFormData.website === 'allwebsite';

  return (
    <div className="product-search-card">
      <div className="card-header">
        {/* <div className="card-icon">
          <i className="bi bi-search"></i>
        </div> */}
        <div className="card-header-content">
          <h3 className="card-title">Single Product Search</h3>
          <p className="card-description">Search for individual products across multiple platforms</p>
        </div>
      </div>
      
      <div className="card-body">
        <form onSubmit={handleSubmit} className="product-search-form">
          
          {/* Website Selection */}
          <div className="form-group">
            <label className="form-label">
            
              Website
            </label>
            <div className="form-input-wrapper">
              <select
                name="website"
                className="form-select"
                value={localFormData.website}
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
                <option value="shopify" className="shopify-option">
                  <i className="bi bi-shop"></i> Shopify Store Scanner
                </option>
              </select>
            </div>
          </div>

          {/* Conditional Inputs based on Shopify selection */}
          {localFormData.website === 'shopify' ? (
            <div className="form-group">
              <label className="form-label">
                <i className="bi bi-link-45deg"></i>
                <span>Store URL</span>
                <span className="required">*</span>
              </label>
              <div className="form-input-wrapper">
                <input
                  type="text"
                  name="store_url"
                  className="form-input"
                  placeholder="e.g. gymshark.com, colourpop.com"
                  value={localFormData.store_url}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-help">
              
                Enter the home page URL of the Shopify store to scan all products.
              </div>
            </div>
          ) : (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    
                    <span>Brand</span>
                    <span className="required">*</span>
                  </label>
                  <div className="form-input-wrapper">
                    <input
                      type="text"
                      name="brand"
                      className="form-input"
                      placeholder="e.g., Samsung, Apple, Sony"
                      value={localFormData.brand}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    
                    <span>Product</span>
                    <span className="required">*</span>
                  </label>
                  <div className="form-input-wrapper">
                    <input
                      type="text"
                      name="product"
                      className="form-input"
                      placeholder="e.g., Smart TV, iPhone, Headphones"
                      value={localFormData.product}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    
                    OEM Number
                  </label>
                  <div className="form-input-wrapper">
                    <input
                      type="text"
                      name="oem_number"
                      className="form-input"
                      placeholder="OEM12345"
                      value={localFormData.oem_number}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    
                    ASIN Number
                  </label>
                  <div className="form-input-wrapper">
                    <input
                      type="text"
                      name="asin_number"
                      className="form-input"
                      placeholder="B0CXYZ123"
                      value={localFormData.asin_number}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Amazon Region Field - Conditionally Rendered */}
          {showAmazonRegion && (
            <div className="form-group">
              <label className="form-label">
                
                Amazon Region
              </label>
              <div className="form-input-wrapper">
                <select
                  name="amazon_country"
                  className="form-select"
                  value={localFormData.amazon_country}
                  onChange={handleChange}
                >
                  <option value="amazon.com">Amazon.com (US)</option>
                  <option value="amazon.co.uk">Amazon UK</option>
                  <option value="amazon.in">Amazon India</option>
                  <option value="amazon.ae">Amazon UAE</option>
                  <option value="amazon.de">Amazon Germany</option>
                  <option value="amazon.fr">Amazon France</option>
                  <option value="amazon.it">Amazon Italy</option>
                  <option value="amazon.es">Amazon Spain</option>
                  <option value="amazon.ca">Amazon Canada</option>
                  <option value="amazon.com.au">Amazon Australia</option>
                  <option value="amazon.sg">Amazon Singapore</option>
                  <option value="amazon.sa">Amazon Saudi Arabia</option>
                  <option value="amazon.nl">Amazon Netherlands</option>
                  <option value="amazon.pl">Amazon Poland</option>
                  <option value="amazon.se">Amazon Sweden</option>
                  <option value="amazon.co.jp">Amazon Japan</option>
                  <option value="amazon.com.br">Amazon Brazil</option>
                  <option value="amazon.com.mx">Amazon Mexico</option>
                </select>
              </div>
              <div className="form-help">
               
                Select which Amazon country you want to scrape. Used when scraping Amazon or All Websites.
              </div>
            </div>
          )}

          <button 
            type="submit" 
            className="search-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="btn-spinner"></div>
                <span>Searching Products...</span>
              </>
            ) : (
              <>
                <i className="bi bi-lightning-charge"></i>
                <span>Start Price Comparison</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProductSearchCard;