import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import api from '../../utils/apiConfig'; // Fixed path (from '../../utils/apiConfig')
import { useAuth } from '../../contexts/AuthContext'; // Fixed path (from '../../contexts/AuthContext')
import ChatWidget from '../common/ChatWidget'; // Fixed path (from '../ChatWidget')
import HeroSection from './HeroSection';
import ProductSearchCard from './ProductSearchCard';
import BulkUploadCard from './BulkUploadCard';
import ResultsSection from './ResultsSection';
import DailyQuiz from './DailyQuiz';
import '../../styles/Dashboard.css'; // Fixed path (from '../../styles/Dashboard.css')
import '../../styles/Table.css'; // Fixed path (from '../../styles/Table.css')

const Dashboard = () => {
  const { user } = useAuth();
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Ref for scrolling to search components
  const searchComponentsRef = useRef(null);

  // --- State Management ---
  const [formData, setFormData] = useState({
    brand: '',
    product: '',
    oem_number: '',
    asin_number: '',
    website: '',
    amazon_country: 'amazon.com',
    store_url: ''
  });
  
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // Filters and Matching State
  const [filters, setFilters] = useState({
    keyword: '',
    website: '',
    maxPrice: ''
  });
  const [matchType, setMatchType] = useState('fuzzy');

  // --- Handlers ---
  const handleFormChange = (newFormData) => {
    setFormData(newFormData);
  };

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };

  const handleScrape = async (formDataToUse) => {
    setLoading(true);
    setError('');
    setResults([]);

    try {
      const response = await api.post('/scrape', formDataToUse);

      if (response.data.error) {
        setError(response.data.error);
      } else {
        setResults(response.data.data);
        // Scroll to results after successful search
        setTimeout(() => {
          if (results.length > 0) {
            document.querySelector('.results-section')?.scrollIntoView({ 
              behavior: 'smooth' 
            });
          }
        }, 500);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'An error occurred during scraping');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpload = async (amazonCountry) => {
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
      uploadFormData.append('amazon_country', amazonCountry || 'amazon.com');

      console.log('🟡 Sending bulk upload with Amazon domain:', amazonCountry);

      const response = await api.post('/scrape', uploadFormData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 300000
      });

      if (response.data.error) {
        setError(response.data.error);
      } else {
        setResults(response.data.data || []);
        setSelectedFile(null);
        if (response.data.data && response.data.data.length === 0) {
          setError('No products found in the uploaded file');
        }
        // Scroll to results after successful upload
        setTimeout(() => {
          if (response.data.data && response.data.data.length > 0) {
            document.querySelector('.results-section')?.scrollIntoView({ 
              behavior: 'smooth' 
            });
          }
        }, 500);
      }
    } catch (error) {
      console.error('Bulk upload error:', error);
      setError(error.response?.data?.error || 'Bulk upload failed. Please check your file format and try again.');
    } finally {
      setBulkLoading(false);
    }
  };

  // Handler for search button in hero section
  const handleHeroSearchClick = (searchTerm) => {
    // Fill the brand/product fields if search term is provided
    if (searchTerm) {
      const newFormData = {
        ...formData,
        product: searchTerm,
        brand: searchTerm.split(' ')[0] // Extract first word as brand
      };
      setFormData(newFormData);
    }
    
    // Scroll to search components
    setTimeout(() => {
      searchComponentsRef.current?.scrollIntoView({ 
        behavior: 'smooth' 
      });
    }, 100);
  };

  // --- Filtering Logic (Memoized) ---
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

      // 4. Exact Match Logic
      let matchesType = true;
      if (formData.website !== 'shopify' && matchType === 'exact') {
        const productName = (item['PRODUCT NAME'] || '').toLowerCase();
        const brandQuery = (item.BRAND || '').toLowerCase();
        const productQuery = (item.PRODUCT || '').toLowerCase();

        const brandWords = brandQuery.split(/\s+/).filter(w => w);
        const productWords = productQuery.split(/\s+/).filter(w => w);

        // Check if all words from brand and product input exist in the result title
        const hasBrand = brandWords.every(word => productName.includes(word));
        const hasProduct = productWords.every(word => productName.includes(word));

        matchesType = hasBrand && hasProduct;
      }

      return matchesKeyword && matchesWebsite && matchesPrice && matchesType;
    });
  }, [results, filters, matchType, formData.website]);


return (
  <div className="premium-dashboard">
    {/* Hero Section with Search */}
    <HeroSection onSearchClick={handleHeroSearchClick} />

    {/* Quiz Section - Placed right after Hero with proper spacing */}
    <div className="dashboard-content">
      <div className="quiz-section-container">
        <DailyQuiz />
      </div>

      {/* Search Components Section with ref */}
      <div ref={searchComponentsRef} className="search-components-section">
        <h2 className="section-title">
          Start Your Search
        </h2>
        
        <div className="content-grid">
          {/* Manual Entry Card */}
          <ProductSearchCard 
            formData={formData}
            onFormChange={handleFormChange}
            onScrape={handleScrape}
            loading={loading}
          />

          {/* Bulk Upload Card */}
          <BulkUploadCard
            onBulkUpload={handleBulkUpload}
            bulkLoading={bulkLoading}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            error={error}
            setError={setError}
          />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-alert">
          <div className="alert-icon">
            <i className="bi bi-exclamation-triangle"></i>
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
        <ResultsSection
          results={results}
          filteredResults={filteredResults}
          filters={filters}
          formData={formData}
          matchType={matchType}
          user={user}
          onFilterChange={handleFilterChange}
          onMatchTypeChange={setMatchType}
          onErrorClear={() => setError('')}
        />
      )}
    </div>

    {/* Chatbot Widget */}
    <ChatWidget />
  </div>
);
};

export default Dashboard;