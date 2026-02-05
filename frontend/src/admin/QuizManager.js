import React, { useState, useEffect } from 'react';
import '../styles/QuizManager.css';

const QuizManager = ({ user }) => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editQuestion, setEditQuestion] = useState(null);
  const [stats, setStats] = useState(null);
  
  const [formData, setFormData] = useState({
    question: '',
    product_name: '',
    correct_price_range: '',
    affiliate_link: '',
    category: 'electronics',
    difficulty: 'medium',
    is_active: true
  });

  useEffect(() => {
    fetchQuestions();
    fetchStats();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/quiz/questions', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setQuestions(data.questions || []);
      }
    } catch (error) {
      console.error('Error fetching questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/quiz/stats', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? e.target.checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = editQuestion 
        ? `/api/admin/quiz/questions/${editQuestion.id}`
        : '/api/admin/quiz/questions';
      
      const method = editQuestion ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        alert(editQuestion ? 'Question updated!' : 'Question created!');
        setShowForm(false);
        setEditQuestion(null);
        setFormData({
          question: '',
          product_name: '',
          correct_price_range: '',
          affiliate_link: '',
          category: 'electronics',
          difficulty: 'medium',
          is_active: true
        });
        fetchQuestions();
        fetchStats();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save question');
      }
    } catch (error) {
      console.error('Error saving question:', error);
      alert('Failed to save question');
    }
  };

  const handleEdit = (question) => {
    setEditQuestion(question);
    setFormData({
      question: question.question,
      product_name: question.product_name,
      correct_price_range: question.correct_price_range || '',
      affiliate_link: question.affiliate_link,
      category: question.category || 'electronics',
      difficulty: question.difficulty || 'medium',
      is_active: question.is_active
    });
    setShowForm(true);
  };

  const handleDelete = async (questionId) => {
    if (!window.confirm('Delete this quiz question?')) return;
    
    try {
      const response = await fetch(`/api/admin/quiz/questions/${questionId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        alert('Question deleted!');
        fetchQuestions();
        fetchStats();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete question');
      }
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Failed to delete question');
    }
  };

  const copyAffiliateLink = (link) => {
    navigator.clipboard.writeText(link);
    alert('Affiliate link copied to clipboard!');
  };

  return (
    <div className="quiz-manager-container">
      {/* Header with Stats */}
      <div className="quiz-header">
        <h2><i className="bi bi-question-circle"></i> Quiz Question Bank</h2>
        <button 
          className="btn btn-primary"
          onClick={() => {
            setEditQuestion(null);
            setFormData({
              question: '',
              product_name: '',
              correct_price_range: '',
              affiliate_link: '',
              category: 'electronics',
              difficulty: 'medium',
              is_active: true
            });
            setShowForm(true);
          }}
        >
          <i className="bi bi-plus-circle"></i> Add New Question
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-number">{stats.total_questions}</div>
            <div className="stat-label">Total Questions</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.active_questions}</div>
            <div className="stat-label">Active Questions</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.total_attempts}</div>
            <div className="stat-label">Total Attempts</div>
          </div>
        </div>
      )}

      {/* Popular Questions */}
      {stats?.popular_questions?.length > 0 && (
        <div className="popular-questions">
          <h5>Most Popular Questions</h5>
          <div className="popular-list">
            {stats.popular_questions.map((item, index) => (
              <div key={index} className="popular-item">
                <span className="product-name">{item.product}</span>
                <span className="attempts">{item.attempts} attempts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form for Add/Edit */}
      {showForm && (
        <div className="quiz-form-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h5>{editQuestion ? 'Edit Question' : 'Add New Question'}</h5>
              <button className="close-btn" onClick={() => setShowForm(false)}>
                <i className="bi bi-x"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Question *</label>
                <textarea
                  name="question"
                  className="form-control"
                  value={formData.question}
                  onChange={handleInputChange}
                  placeholder="e.g., Guess the price of iPhone 15 Pro Max"
                  required
                  rows="3"
                />
              </div>
              
              <div className="row">
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Product Name *</label>
                    <input
                      type="text"
                      name="product_name"
                      className="form-control"
                      value={formData.product_name}
                      onChange={handleInputChange}
                      placeholder="e.g., iPhone 15 Pro Max"
                      required
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Correct Price Range (Optional)</label>
                    <input
                      type="text"
                      name="correct_price_range"
                      className="form-control"
                      value={formData.correct_price_range}
                      onChange={handleInputChange}
                      placeholder="e.g., $999-$1099"
                    />
                  </div>
                </div>
              </div>
              
              <div className="form-group">
                <label>Affiliate Link *</label>
                <input
                  type="url"
                  name="affiliate_link"
                  className="form-control"
                  value={formData.affiliate_link}
                  onChange={handleInputChange}
                  placeholder="https://amazon.com/product-link"
                  required
                />
              </div>
              
              <div className="row">
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Category</label>
                    <select
                      name="category"
                      className="form-control"
                      value={formData.category}
                      onChange={handleInputChange}
                    >
                      <option value="electronics">Electronics</option>
                      <option value="fashion">Fashion</option>
                      <option value="home">Home & Kitchen</option>
                      <option value="sports">Sports</option>
                      <option value="books">Books</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Difficulty</label>
                    <select
                      name="difficulty"
                      className="form-control"
                      value={formData.difficulty}
                      onChange={handleInputChange}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="form-check">
                <input
                  type="checkbox"
                  name="is_active"
                  className="form-check-input"
                  checked={formData.is_active}
                  onChange={handleInputChange}
                  id="isActiveCheck"
                />
                <label className="form-check-label" htmlFor="isActiveCheck">
                  Active (Visible to users)
                </label>
              </div>
              
              <div className="form-actions">
                <button type="submit" className="btn btn-success">
                  {editQuestion ? 'Update Question' : 'Create Question'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="questions-list">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary"></div>
          </div>
        ) : questions.length === 0 ? (
          <div className="empty-state">
            <i className="bi bi-question-circle display-4 text-muted"></i>
            <h4>No Quiz Questions</h4>
            <p>Add your first quiz question to start engaging users!</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Affiliate Link</th>
                  <th>Shown</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <div className="question-text">{q.question}</div>
                      {q.correct_price_range && (
                        <small className="text-muted">
                          Answer: {q.correct_price_range}
                        </small>
                      )}
                    </td>
                    <td>{q.product_name}</td>
                    <td>
                      <span className={`badge category-${q.category}`}>
                        {q.category}
                      </span>
                    </td>
                    <td>
                      <div className="affiliate-link">
                        <span className="truncated-link">
                          {q.affiliate_link.substring(0, 30)}...
                        </span>
                        <button 
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => copyAffiliateLink(q.affiliate_link)}
                        >
                          <i className="bi bi-copy"></i>
                        </button>
                      </div>
                    </td>
                    <td>{q.show_count} times</td>
                    <td>
                      <span className={`badge ${q.is_active ? 'bg-success' : 'bg-secondary'}`}>
                        {q.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn btn-sm btn-primary"
                          onClick={() => handleEdit(q)}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button 
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(q.id)}
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
        )}
      </div>
    </div>
  );
};

export default QuizManager;