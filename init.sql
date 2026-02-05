-- Add to your existing database tables

CREATE TABLE IF NOT EXISTS quiz_questions (
    id VARCHAR(36) PRIMARY KEY,
    question TEXT NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    correct_price_range VARCHAR(100),
    affiliate_link TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'electronics',
    difficulty VARCHAR(20) DEFAULT 'medium',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_shown_date DATE,
    show_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_quiz_attempts (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id VARCHAR(36) NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    guessed_price VARCHAR(50),
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    redirect_to_affiliate BOOLEAN DEFAULT FALSE
);

-- Create indexes for better performance
CREATE INDEX idx_quiz_questions_active ON quiz_questions(is_active, last_shown_date);
CREATE INDEX idx_quiz_attempts_user_date ON user_quiz_attempts(user_id, attempted_at);
CREATE INDEX idx_quiz_attempts_question ON user_quiz_attempts(question_id);

-- Insert sample quiz questions
INSERT INTO quiz_questions (id, question, product_name, correct_price_range, affiliate_link, category, difficulty, is_active) VALUES
(uuid_generate_v4(), 'Guess the current price of iPhone 15 Pro Max (256GB)', 'iPhone 15 Pro Max', '$1199-$1299', 'https://amazon.com/iphone-15-pro-max', 'electronics', 'medium', true),
(uuid_generate_v4(), 'What is the typical price for Samsung Galaxy S24 Ultra?', 'Samsung Galaxy S24 Ultra', '$1299-$1399', 'https://amazon.com/samsung-s24-ultra', 'electronics', 'medium', true),
(uuid_generate_v4(), 'Estimate the price of Sony WH-1000XM5 headphones', 'Sony WH-1000XM5', '$349-$399', 'https://amazon.com/sony-wh1000xm5', 'electronics', 'easy', true),
(uuid_generate_v4(), 'How much does the MacBook Air M3 (13-inch) cost?', 'MacBook Air M3', '$1099-$1199', 'https://amazon.com/macbook-air-m3', 'electronics', 'medium', true),
(uuid_generate_v4(), 'Guess the price of the Nintendo Switch OLED Model', 'Nintendo Switch OLED', '$349-$399', 'https://amazon.com/nintendo-switch-oled', 'electronics', 'easy', true);