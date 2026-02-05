import React, { useState, useEffect } from 'react';
// import '../../styles/DailyQuiz.css';
import api from '../../utils/apiConfig';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/Dashboard.css';
const DailyQuiz = () => {
  const { user } = useAuth();
  const [quizData, setQuizData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState(null);
  const [guessedPrice, setGuessedPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Move fetchUserStats before useEffect
  const fetchUserStats = async () => {
    try {
      const response = await api.get('/quiz/user-stats');
      setUserStats(response.data);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  // Move fetchDailyQuiz before useEffect
  const fetchDailyQuiz = async () => {
    setLoading(true);
    try {
      const response = await api.get('/quiz/daily');
      
      if (response.status === 404) {
        // No quiz available
        setQuizData({ error: "No quiz available" });
      } else if (response.data.error) {
        // Other error
        console.error('Quiz error:', response.data.error);
        setQuizData({ error: response.data.error });
      } else {
        // Success
        setQuizData(response.data);
      }
    } catch (error) {
      console.error('Error fetching daily quiz:', error);
      if (error.response?.status === 404) {
        setQuizData({ error: "No quiz available at the moment" });
      } else {
        setQuizData({ error: "Failed to load quiz. Please try again." });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyQuiz();
    fetchUserStats();
  }, []);

  const handleCheckAnswer = async () => {
    if (!guessedPrice.trim()) {
      alert('Please enter your price guess!');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/quiz/check-answer', {
        question_id: quizData.question_id,
        guessed_price: guessedPrice
      });

      if (response.data.success) {
        // Redirect to affiliate link
        window.open(response.data.affiliate_link, '_blank', 'noopener,noreferrer');
        
        // Refresh stats
        fetchUserStats();
        // Refresh quiz data to show "already attempted" state
        fetchDailyQuiz();
        
        // Show success message
        alert(`Checking answer for ${response.data.product_name}... Redirecting!`);
      }
    } catch (error) {
      console.error('Error checking answer:', error);
      alert('Failed to process your answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getDifficultyBadge = (difficulty) => {
    const classes = {
      easy: 'badge-success',
      medium: 'badge-warning',
      hard: 'badge-danger'
    };
    return classes[difficulty] || 'badge-secondary';
  };

  // Remove duplicate loading check - we already have one
  // Remove the second duplicate loading check and the duplicate condition

  if (loading) {
    return (
      <div className="daily-quiz-card loading">
        <div className="spinner-border text-primary"></div>
        <p>Loading today's quiz...</p>
      </div>
    );
  }

  // Handle error state
  if (quizData?.error) {
    return (
      <div className="daily-quiz-card no-quiz">
        <div className="quiz-header">
          <div className="quiz-badge">
            <i className="bi bi-question-circle"></i>
            <span>Daily Quiz</span>
          </div>
        </div>
        <div className="quiz-body">
          <div className="no-quiz-message">
            <i className="bi bi-emoji-frown display-4"></i>
            <h5>No Quiz Available</h5>
            <p>{quizData.error}</p>
            <button 
              className="btn btn-outline-light"
              onClick={fetchDailyQuiz}
            >
              <i className="bi bi-arrow-clockwise"></i> Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Handle already attempted state
  if (quizData?.already_attempted) {
    return (
      <div className="daily-quiz-card attempted">
        <div className="quiz-header">
          <div className="quiz-badge">
            <i className="bi bi-trophy"></i>
            <span>Daily Quiz</span>
          </div>
          <div className="quiz-stats">
            {userStats && (
              <span className="streak">
                <i className="bi bi-fire"></i> {userStats.streak_days} day streak
              </span>
            )}
          </div>
        </div>
        
        <div className="quiz-body">
          <div className="attempted-message">
            <i className="bi bi-check-circle success-icon"></i>
            <h5>You've Already Played Today!</h5>
            <p>Come back tomorrow for a new price guessing challenge!</p>
            
            {quizData.redirect_to_affiliate && (
              <button 
                className="btn btn-outline-light"
                onClick={() => window.open(quizData.affiliate_link, '_blank', 'noopener,noreferrer')}
              >
                <i className="bi bi-cart"></i> Visit Product Page
              </button>
            )}
          </div>
          
          {userStats && (
            <div className="user-stats">
              <div className="stat-item">
                <div className="stat-number">{userStats.total_attempts}</div>
                <div className="stat-label">Total Plays</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{userStats.streak_days}</div>
                <div className="stat-label">Day Streak</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Handle no question_id but no error (should not happen, but safe fallback)
  if (!quizData?.question_id) {
    return (
      <div className="daily-quiz-card no-quiz">
        <div className="quiz-header">
          <div className="quiz-badge">
            <i className="bi bi-question-circle"></i>
            <span>Daily Quiz</span>
          </div>
        </div>
        <div className="quiz-body">
          <div className="no-quiz-message">
            <i className="bi bi-info-circle display-4"></i>
            <h5>No Quiz Available</h5>
            <p>Check back later for today's quiz challenge!</p>
            <button 
              className="btn btn-outline-light"
              onClick={fetchDailyQuiz}
            >
              <i className="bi bi-arrow-clockwise"></i> Refresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main quiz UI
  return (
    <div className="daily-quiz-card active">

      
      <div className="quiz-body">
        <h5 className="quiz-question">{quizData.question}</h5>
        <p className="quiz-product">
          <i className="bi bi-box-seam"></i> Product: <strong>{quizData.product_name}</strong>
        </p>
        
        <div className="price-input-section">
       
          <div className="input-group">
            <span className="input-group-text">$</span>
            <input
              type="number"
              className="form-control"
              placeholder="Enter estimated price"
              value={guessedPrice}
              onChange={(e) => setGuessedPrice(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>
          <small className="form-text text-muted">
            Enter your best guess for the current market price
          </small>
        </div>
        
        <div className="quiz-footer">
          <button 
            className="btn btn-primary quiz-submit"
            onClick={handleCheckAnswer}
            disabled={!guessedPrice.trim() || submitting}
          >
            {submitting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Processing...
              </>
            ) : (
              <>
                <i className="bi bi-check-circle me-2"></i>
                Check Answer & View Product
              </>
            )}
          </button>
          
          <div className="quiz-note">
            <i className="bi bi-info-circle"></i>
            Clicking "Check Answer" will redirect you to the product page
          </div>
        </div>
        
        {userStats && (
          <div className="mini-stats">
            <span>
              <i className="bi bi-check2-all"></i> {userStats.total_attempts} quizzes played
            </span>
            {userStats.streak_days > 0 && (
              <span>
                <i className="bi bi-fire"></i> {userStats.streak_days} day streak
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyQuiz;