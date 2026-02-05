import React, { useState, useCallback } from 'react';
import '../../styles/BulkUploadCard.css';

const BulkUploadCard = ({ 
  onBulkUpload,
  bulkLoading,
  selectedFile,
  setSelectedFile,
  error,
  setError 
}) => {
  const [bulkAmazonCountry, setBulkAmazonCountry] = useState('amazon.com');
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
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

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (file) => {
    const validTypes = ['.csv', '.xlsx', '.xls'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!validTypes.includes(fileExtension)) {
      setError('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size should be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setError('');
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  const handleUpload = () => {
    onBulkUpload(bulkAmazonCountry);
  };

  return (
    <div className="bulk-upload-card">
      <div className="card-header">
        {/* <div className="card-icon">
          <i className="bi bi-cloud-arrow-up"></i>
        </div> */}
        <div className="card-header-content">
          <h3 className="card-title">Bulk Product Analysis</h3>
          <p className="card-description">Upload multiple products at once for comprehensive comparison</p>
        </div>
      </div>

      <div className="card-body">
        <div 
          className={`upload-zone ${dragActive ? 'drag-active' : ''} ${selectedFile ? 'has-file' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => document.getElementById('fileInput').click()}
        >
          <input
            type="file"
            id="fileInput"
            className="file-input"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileInput}
          />
          
          {selectedFile ? (
            <div className="file-preview">
              <div className="file-icon success">
                <i className="bi bi-file-earmark-check"></i>
              </div>
              <div className="file-info">
                <div className="file-name">{selectedFile.name}</div>
                <div className="file-details">
                  <span className="file-size">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                  <span className="file-type">
                    {selectedFile.name.split('.').pop().toUpperCase()}
                  </span>
                </div>
              </div>
              <button 
                className="file-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile();
                }}
              >
                <i className="bi bi-x"></i>
              </button>
            </div>
          ) : (
            <div className="upload-content">
              <div className="upload-icon">
                <i className="bi bi-cloud-arrow-up"></i>
              </div>
              <h4 className="upload-title">Drag & Drop Your File</h4>
              <p className="upload-description">
                Supported formats: CSV, Excel (.csv, .xlsx, .xls)
              </p>
              {/* <p className="upload-note">Maximum file size: 10MB</p> */}
              <button className="browse-button" type="button">
                <i className="bi bi-folder2-open"></i>
                Browse Files
              </button>
            </div>
          )}
        </div>

        {/* Amazon Region for Bulk Upload */}
        <div className="form-group">
          <label className="form-label">
            <i className="bi bi-globe-americas"></i>
            Amazon Region
          </label>
          <div className="form-input-wrapper">
            <select
              name="amazon_country"
              className="form-select"
              value={bulkAmazonCountry}
              onChange={(e) => setBulkAmazonCountry(e.target.value)}
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
            {/* <i className="bi bi-info-circle"></i> */}
            Select which Amazon country you want to scrape for bulk upload.
          </div>
        </div>

        <div className="upload-guide">
          <h5 className="guide-title">
            {/* <i className="bi bi-file-earmark-text"></i> */}
            File Format Requirements
          </h5>
          <ul className="guide-list">
            <li>
              {/* <i className="bi bi-check-circle"></i> */}
              Include columns: <strong>Brand, Product, Website Name</strong>
            </li>
            <li>
              {/* <i className="bi bi-check-circle"></i> */}
              Optional columns: <strong>OEM Number, ASIN Number</strong>
            </li>
            <li>
              {/* <i className="bi bi-check-circle"></i> */}
              First row should contain headers
            </li>
            <li>
              {/* <i className="bi bi-check-circle"></i> */}
              Supported formats: CSV, XLSX, XLS
            </li>
          </ul>
        </div>

        <button 
          className="upload-button"
          onClick={handleUpload}
          disabled={!selectedFile || bulkLoading}
        >
          {bulkLoading ? (
            <>
              <div className="btn-spinner"></div>
              <span>Processing Bulk Upload...</span>
            </>
          ) : (
            <>
              <i className="bi bi-rocket-takeoff"></i>
              <span>Analyze Multiple Products</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default BulkUploadCard;