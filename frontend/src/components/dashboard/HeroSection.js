import React, { useState } from 'react';
import '../../styles/HeroSection.css';

const HeroSection = ({ onSearchClick }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    // Pass the search term to parent component
    onSearchClick && onSearchClick(searchTerm);
  };

  const handleExampleClick = (example) => {
    setSearchTerm(example);
    // Pass the example to parent component
    onSearchClick && onSearchClick(example);
  };

  return (
    <div className="dashboard-hero">
      <div className="hero-content">
        <div className="hero-text">
          <h1 className="hero-title">
            Find the Best Deals
            <span>Across All Stores</span>
          </h1>
          <p className="hero-subtitle">
            Compare prices in real-time from Amazon, eBay, Shopify, and more
          </p>
        </div>

        <form onSubmit={handleSearch} className="hero-search">
          <div className="search-wrapper">
            <input
              type="text"
              className="search-input"
              placeholder="What product are you looking for?"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={true} 
            />
            <button type="submit" className="rightsearchbutton" disabled={true} >
              Search Now
            </button>
          </div>
          <div className="search-examples">
            <span className="search-example" disabled={true}  >iPhone 15 Pro</span>
            <span className="search-example"disabled={true} >Samsung Galaxy S24</span>
            <span className="search-example" disabled={true} >Nike Air Max</span>
            <span className="search-example" disabled={true} >MacBook Air</span>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HeroSection;