import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from db_models import QuizQuestion
import uuid
from datetime import datetime, timezone

def populate_quiz_questions():
    with app.app_context():
        # Check if questions already exist
        existing = QuizQuestion.query.first()
        if existing:
            print("Quiz questions already exist. Skipping...")
            return
        
        sample_questions = [
            {
                "id": str(uuid.uuid4()),
                "question": "Guess the current price of iPhone 15 Pro Max (256GB)",
                "product_name": "iPhone 15 Pro Max",
                "correct_price_range": "$1199-$1299",
                "affiliate_link": "https://www.amazon.com/dp/B0CHX1W1HY",
                "category": "electronics",
                "difficulty": "medium",
                "is_active": True
            },
            {
                "id": str(uuid.uuid4()),
                "question": "What's the typical price for Samsung Galaxy S24 Ultra?",
                "product_name": "Samsung Galaxy S24 Ultra",
                "correct_price_range": "$1299-$1399",
                "affiliate_link": "https://www.amazon.com/dp/B0CMTZJK1R",
                "category": "electronics",
                "difficulty": "medium",
                "is_active": True
            },
            {
                "id": str(uuid.uuid4()),
                "question": "Estimate the price of Sony WH-1000XM5 noise-cancelling headphones",
                "product_name": "Sony WH-1000XM5",
                "correct_price_range": "$349-$399",
                "affiliate_link": "https://www.amazon.com/dp/B09XS7JWHH",
                "category": "electronics",
                "difficulty": "easy",
                "is_active": True
            },
            {
                "id": str(uuid.uuid4()),
                "question": "How much does the MacBook Air M3 (13-inch) typically cost?",
                "product_name": "MacBook Air M3",
                "correct_price_range": "$1099-$1199",
                "affiliate_link": "https://www.amazon.com/dp/B0D3R4RXSG",
                "category": "electronics",
                "difficulty": "medium",
                "is_active": True
            },
            {
                "id": str(uuid.uuid4()),
                "question": "Guess the price of the Nintendo Switch OLED Model",
                "product_name": "Nintendo Switch OLED",
                "correct_price_range": "$349-$399",
                "affiliate_link": "https://www.amazon.com/dp/B098RL6SBJ",
                "category": "electronics",
                "difficulty": "easy",
                "is_active": True
            },
            {
                "id": str(uuid.uuid4()),
                "question": "What's the price range for Apple AirPods Pro (2nd Generation)?",
                "product_name": "Apple AirPods Pro",
                "correct_price_range": "$229-$249",
                "affiliate_link": "https://www.amazon.com/dp/B0CHWK3K1R",
                "category": "electronics",
                "difficulty": "easy",
                "is_active": True
            },
            {
                "id": str(uuid.uuid4()),
                "question": "Estimate the cost of iPad Pro 12.9-inch (M2 chip)",
                "product_name": "iPad Pro 12.9-inch",
                "correct_price_range": "$1099-$1299",
                "affiliate_link": "https://www.amazon.com/dp/B0BJLH5J4M",
                "category": "electronics",
                "difficulty": "hard",
                "is_active": True
            }
        ]
        
        for q_data in sample_questions:
            question = QuizQuestion(**q_data)
            db.session.add(question)
        
        try:
            db.session.commit()
            print(f"✅ Successfully added {len(sample_questions)} quiz questions!")
            
            # Verify
            count = QuizQuestion.query.count()
            print(f"Total quiz questions in database: {count}")
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error adding quiz questions: {e}")
            return False
        
        return True

if __name__ == "__main__":
    populate_quiz_questions()