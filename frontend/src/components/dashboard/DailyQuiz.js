import React, { useState, useEffect } from 'react';
import api from '../../utils/apiConfig';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/DailyQuiz.css';

const DailyQuiz = () => {
  const { user } = useAuth();
  const [quizData, setQuizData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState(null);
  const [guessedPrice, setGuessedPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchUserStats = async () => {
    try {
      const response = await api.get('/quiz/user-stats');
      setUserStats(response.data);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const fetchDailyQuiz = async () => {
    setLoading(true);
    try {
      const response = await api.get('/quiz/daily');
      
      if (response.status === 404) {
        setQuizData({ error: "No quiz available" });
      } else if (response.data.error) {
        console.error('Quiz error:', response.data.error);
        setQuizData({ error: response.data.error });
      } else {
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
        window.open(response.data.affiliate_link, '_blank', 'noopener,noreferrer');
        fetchUserStats();
        fetchDailyQuiz();
        alert(`Checking answer for ${response.data.product_name}... Redirecting!`);
      }
    } catch (error) {
      console.error('Error checking answer:', error);
      alert('Failed to process your answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-quiz-card quiz-loading">
        <div className="spinner-border"></div>
        <p>Loading today's quiz...</p>
      </div>
    );
  }

  if (quizData?.error) {
    return (
      <div className="dashboard-quiz-card quiz-no-quiz">
        <div className="quiz-dashboard-header">
          <h3 className="quiz-dashboard-title">
            <i className="bi bi-question-circle"></i>
            Daily Quiz
          </h3>
        </div>
        <div className="dashboard-quiz-noquiz">
          <i className="bi bi-emoji-frown"></i>
          <h5>No Quiz Available</h5>
          <p>{quizData.error}</p>
          <button 
            className="dashboard-quiz-refresh-btn"
            onClick={fetchDailyQuiz}
          >
            <i className="bi bi-arrow-clockwise"></i> Try Again
          </button>
        </div>
      </div>
    );
  }

  if (quizData?.already_attempted) {
    return (
      <div className="dashboard-quiz-card quiz-attempted">
        <div className="quiz-dashboard-header">
          <h3 className="quiz-dashboard-title">
            <i className="bi bi-trophy"></i>
            Daily Quiz
          </h3>
          <div className="quiz-dashboard-stats">
            {userStats && userStats.streak_days > 0 && (
              <span className="quiz-dashboard-streak">
                <i className="bi bi-fire"></i> {userStats.streak_days} day streak
              </span>
            )}
          </div>
        </div>
        
        <div className="quiz-dashboard-body">
          <div className="dashboard-quiz-attempted">
            <i className="bi bi-check-circle dashboard-quiz-success-icon"></i>
            <h5>You've Already Played Today!</h5>
            <p>Come back tomorrow for a new price guessing challenge!</p>
            
            {quizData.redirect_to_affiliate && (
              <button 
                className="dashboard-quiz-attempted-btn"
                onClick={() => window.open(quizData.affiliate_link, '_blank', 'noopener,noreferrer')}
              >
                <i className="bi bi-cart"></i> Visit Product Page
              </button>
            )}
          </div>
          
          {userStats && (
            <div className="dashboard-quiz-user-stats">
              <div className="dashboard-quiz-stat-item">
                <div className="dashboard-quiz-stat-number">{userStats.total_attempts}</div>
                <div className="dashboard-quiz-stat-label">Total Plays</div>
              </div>
              <div className="dashboard-quiz-stat-item">
                <div className="dashboard-quiz-stat-number">{userStats.streak_days}</div>
                <div className="dashboard-quiz-stat-label">Day Streak</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!quizData?.question_id) {
    return (
      <div className="dashboard-quiz-card quiz-no-quiz">
        <div className="quiz-dashboard-header">
          <h3 className="quiz-dashboard-title">
            <i className="bi bi-question-circle"></i>
            Daily Quiz
          </h3>
        </div>
        <div className="dashboard-quiz-noquiz">
          <i className="bi bi-info-circle"></i>
          <h5>No Quiz Available</h5>
          <p>Check back later for today's quiz challenge!</p>
          <button 
            className="dashboard-quiz-refresh-btn"
            onClick={fetchDailyQuiz}
          >
            <i className="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-quiz-card">
      <div className="quiz-dashboard-header">
        <h3 className="quiz-dashboard-title">
          <i className="bi bi-question-circle"></i>
          Daily Quiz
        </h3>
        {userStats && userStats.streak_days > 0 && (
          <div className="quiz-dashboard-stats">
            <span className="quiz-dashboard-streak">
              <i className="bi bi-fire"></i> {userStats.streak_days} day streak
            </span>
          </div>
        )}
      </div>
      
      <div className="quiz-dashboard-body">
        <h4 className="quiz-dashboard-question">{quizData.question}</h4>
        <div className="quiz-dashboard-product">
          <i className="bi bi-box-seam"></i>
          <span>Product: <strong>{quizData.product_name}</strong></span>
        </div>
        
        <div className="quiz-dashboard-input-section">
          <div className="quiz-dashboard-input-group">
            <span className="quiz-dashboard-input-prefix">$</span>
            <input
              type="number"
              className="quiz-dashboard-input"
              placeholder="Enter estimated price"
              value={guessedPrice}
              onChange={(e) => setGuessedPrice(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>
          <small className="quiz-dashboard-hint">
            Enter your best guess for the current market price
          </small>
        </div>
        
        <button 
          className="quiz-dashboard-submit"
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
        
        <div className="quiz-dashboard-note">
          <i className="bi bi-info-circle"></i>
          <span>Clicking "Check Answer" will redirect you to the product page</span>
        </div>
        
        {userStats && (
          <div className="dashboard-quiz-mini-stats">
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