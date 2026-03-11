import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, engine
from app import models
from app.models import Base

# Create tables
Base.metadata.create_all(bind=engine)

def seed_data():
    db = SessionLocal()
    try:
        # Create a test student and teacher
        student = models.User(username="learner1", email="learner@test.com", role="student", hashed_password="hashed")
        teacher = models.User(username="coach_amateur", email="coach@test.com", role="teacher", hashed_password="hashed")
        db.add_all([student, teacher])
        db.commit()

        # Create a test reading lesson
        lesson1 = models.Lesson(
            title="The History of Tea",
            chapter="Chapter 1: Food & Drink",
            type="reading",
            content={
                "paragraphs": [
                    {"id": "p1", "text": "Tea is the second most consumed beverage in the world, after water. Originating in China, it has a history spanning thousands of years."}
                ]
            }
        )
        db.add(lesson1)
        db.commit()

        # Create some test questions
        q1 = models.Question(
            lesson_id=lesson1.id,
            type="multiple_choice",
            question_text="What is the most consumed beverage in the world?",
            options={"A": "Tea", "B": "Coffee", "C": "Water", "D": "Milk"},
            correct_answer="C"
        )
        db.add(q1)
        db.commit()

        # Create a test vocab vault entry
        vocab1 = models.VocabVault(
            user_id=student.id,
            word="beverage",
            meaning="Đồ uống, thức uống (ngoại trừ nước lọc)",
            ipa="/ˈbev.ər.ɪdʒ/",
            source_lesson_id=lesson1.id
        )
        db.add(vocab1)
        db.commit()

        print("Successfully seeded database with mock data!")
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
