"""
LWAC IELTS Data Seeder v2
Populates the database with rich IELTS Reading, Writing, and Listening lessons.
Run: python seed_data.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine
from app import models

# Ensure tables exist
models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed_users():
    accounts = [
        {"username": "coach", "email": "coach@lwac.local", "full_name": "Coach LWAC", "password": "coach123", "role": "coach", "avatar_color": "#0d9488"},
        {"username": "student1", "email": "student1@lwac.local", "full_name": "Nguyen Van A", "password": "student123", "role": "student", "avatar_color": "#7c3aed"},
        {"username": "student2", "email": "student2@lwac.local", "full_name": "Tran Thi B", "password": "student123", "role": "student", "avatar_color": "#dc2626"},
    ]
    for acc in accounts:
        existing = db.query(models.User).filter(models.User.username == acc["username"]).first()
        if existing:
            # Update password hash if it's not a real hash
            if not existing.hashed_password.startswith("$2b$"):
                existing.hashed_password = pwd_context.hash(acc["password"])
                existing.full_name = acc.get("full_name", existing.username)
                existing.avatar_color = acc.get("avatar_color", "#0d9488")
                existing.role = acc["role"]
                db.commit()
                print(f"  [updated] {acc['username']} (password hashed)")
            else:
                print(f"  [skip] User already exists: {acc['username']}")
            continue
        user = models.User(
            username=acc["username"],
            email=acc["email"],
            full_name=acc["full_name"],
            hashed_password=pwd_context.hash(acc["password"]),
            role=acc["role"],
            avatar_color=acc["avatar_color"]
        )
        db.add(user)
        db.commit()
        print(f"  [ok] Created {acc['role']}: {acc['username']} / {acc['password']}")


def seed_lessons():
    lessons_data = [
        # ====== READING 1 ======
        {
            "title": "IELTS Reading: Nutmeg - a valuable spice",
            "chapter": "Cambridge IELTS 15 - Test 1",
            "type": "reading",
            "content": {
                "paragraphs": [
                    {"id": "p1", "text": "The nutmeg tree, Myristica fragrans, is a large evergreen tree native to Southeast Asia. Until the late 18th century, it only grew in one place in the world: a small group of islands in the Banda Sea, part of the Moluccas – or Spice Islands – in Indonesia."},
                    {"id": "p2", "text": "The tree is thickly branched with dense foliage of tough, dark green oval leaves, and produces small, yellow, bell-shaped flowers and pale yellow pear-shaped fruits. The fruit is encased in a fleshy husk. When the fruit is ripe, this husk splits into two halves along a ridge running the length of the fruit."},
                    {"id": "p3", "text": "Inside is a purple-brown shiny seed, 2–3 cm long by about 2 cm across, surrounded by a lacy red or crimson covering called an 'aril'. These are the sources of the two spices nutmeg and mace, the former being produced from the dried seed and the latter from the aril."},
                    {"id": "p4", "text": "Nutmeg was a highly prized and costly ingredient in European cuisine in the Middle Ages, and was used as a flavouring, medicinal, and preservative agent. Throughout this period, the Arabs were the exclusive importers of the spice to Europe. They sold nutmeg for high prices to merchants based in Venice, but they never revealed the exact location of the source of this extremely valuable cargo."}
                ]
            },
            "questions": [
                {"type": "multiple_choice", "question_text": "In the Middle Ages, most Europeans knew where nutmeg was grown. (True / False / Not Given)", "options": {"True": "True", "False": "False", "Not Given": "Not Given"}, "correct_answer": "False"},
                {"type": "multiple_choice", "question_text": "The VOC was the world's first major trading company. (True / False / Not Given)", "options": {"True": "True", "False": "False", "Not Given": "Not Given"}, "correct_answer": "Not Given"},
                {"type": "fill_blank", "question_text": "The lacy red covering surrounding the nutmeg seed is called the _______.", "options": {}, "correct_answer": "aril"},
                {"type": "fill_blank", "question_text": "During the Middle Ages, the _______ were the exclusive importers of nutmeg to Europe.", "options": {}, "correct_answer": "Arabs"},
                {"type": "multiple_choice", "question_text": "What does the fleshy husk do when the nutmeg fruit is ripe?", "options": {"A": "It falls to the ground", "B": "It splits into two halves", "C": "It turns red", "D": "It produces mace"}, "correct_answer": "B"}
            ]
        },

        # ====== READING 2 ======
        {
            "title": "IELTS Reading: Driverless cars",
            "chapter": "Cambridge IELTS 15 - Test 1",
            "type": "reading",
            "content": {
                "paragraphs": [
                    {"id": "p1", "text": "The automotive sector is well used to adapting to automation in manufacturing. The implementation of robotic car manufacture from the 1970s onwards led to significant cost savings and improvements in the reliability and flexibility of vehicle mass production."},
                    {"id": "p2", "text": "A new challenge to vehicle production is now on the horizon and, again, it comes from automation. However, this time it is not to do with the manufacturing process, but with the vehicles themselves. Research projects on vehicle automation are not new."},
                    {"id": "p3", "text": "Vehicles with limited self-driving capabilities have been around for more than 50 years. This has included significant contributions from research organizations, such as the UK’s Transport Research Laboratory, which has demonstrated remote control and automated vehicles."},
                    {"id": "p4", "text": "There are many reasons why technology is advancing so fast. One frequently cited motive is safety; indeed, research at the UK’s Transport Research Laboratory has demonstrated that more than 90 percent of road collisions involve human error as a contributory factor."},
                    {"id": "p5", "text": "Another aim is to free the time people spend driving for other purposes. If the vehicle can do some or all of the driving, it may be possible to be productive, to socialize or simply to relax while in transit."}
                ]
            },
            "questions": [
                {"type": "multiple_choice", "question_text": "What percentage of road collisions involve human error?", "options": {"A": "10%", "B": "50%", "C": "More than 90%", "D": "100%"}, "correct_answer": "C"},
                {"type": "multiple_choice", "question_text": "Automation in manufacturing since the 1970s led to:", "options": {"A": "Higher costs", "B": "Cost savings and better reliability", "C": "Fewer car choices", "D": "More road accidents"}, "correct_answer": "B"},
                {"type": "fill_blank", "question_text": "One frequently cited motive for advancing driverless technology is _______.", "options": {}, "correct_answer": "safety"},
                {"type": "fill_blank", "question_text": "The UK organization mentioned in the text is the Transport _______ Laboratory.", "options": {}, "correct_answer": "Research"},
                {"type": "multiple_choice", "question_text": "Another aim of driverless cars is to free the time people spend driving for other ______.", "options": {"A": "Jobs", "B": "Purposes", "C": "Cars", "D": "Hobbies"}, "correct_answer": "B"}
            ]
        },

        # ====== READING 3 ======
        {
            "title": "Urbanization and Its Effects",
            "chapter": "Chapter 3: Society & Culture",
            "type": "reading",
            "content": {
                "paragraphs": [
                    {"id": "p1", "text": "Urbanization is one of the most significant global trends of the 21st century. By 2050, it is projected that nearly 70% of the world's population will live in cities."},
                    {"id": "p2", "text": "Cities offer better access to education, healthcare, and employment. However, unplanned urbanization can lead to overcrowding, environmental degradation, and increased inequality. Slums and informal settlements house a significant proportion of urban populations in developing countries."},
                    {"id": "p3", "text": "Smart city initiatives aim to leverage technology to improve urban life. These include intelligent transportation systems, energy-efficient buildings, and digital public services. Singapore, Copenhagen, and Seoul are often cited as leading examples of smart city development."},
                    {"id": "p4", "text": "Urban green spaces play a vital role in the well-being of city residents. Parks, gardens, and urban forests help reduce air pollution, lower temperatures during heatwaves, and provide recreational areas for communities. Studies have shown that access to green spaces can significantly reduce stress and improve mental health."},
                    {"id": "p5", "text": "Public transportation is another critical factor in sustainable urban development. Cities with well-designed metro and bus systems tend to have lower carbon emissions per capita. Tokyo, for example, moves 40 million passengers daily through its extensive rail network with remarkable efficiency."}
                ]
            },
            "questions": [
                {"type": "multiple_choice", "question_text": "By 2050, what percentage of the world's population is expected to live in cities?", "options": {"A": "50%", "B": "60%", "C": "70%", "D": "80%"}, "correct_answer": "C"},
                {"type": "multiple_choice", "question_text": "Which of the following is NOT mentioned as a problem of urbanization?", "options": {"A": "Overcrowding", "B": "Environmental degradation", "C": "Water scarcity", "D": "Inequality"}, "correct_answer": "C"},
                {"type": "multiple_choice", "question_text": "Which city is NOT mentioned as a smart city example?", "options": {"A": "Singapore", "B": "Tokyo", "C": "Copenhagen", "D": "Seoul"}, "correct_answer": "B"},
                {"type": "multiple_choice", "question_text": "What benefit do urban green spaces NOT provide according to the text?", "options": {"A": "Reduce air pollution", "B": "Lower temperatures", "C": "Increase property values", "D": "Reduce stress"}, "correct_answer": "C"},
                {"type": "multiple_choice", "question_text": "How many passengers does Tokyo's rail network move daily?", "options": {"A": "10 million", "B": "20 million", "C": "30 million", "D": "40 million"}, "correct_answer": "D"},
                {"type": "multiple_choice", "question_text": "What do cities with good public transport tend to have?", "options": {"A": "Higher GDP", "B": "Lower carbon emissions", "C": "More tourists", "D": "Better schools"}, "correct_answer": "B"},
                {"type": "fill_blank", "question_text": "By 2050, nearly _______% of people will live in cities.", "options": {}, "correct_answer": "70"},
                {"type": "fill_blank", "question_text": "Access to green spaces can significantly reduce _______ and improve mental health.", "options": {}, "correct_answer": "stress"}
            ]
        },

        # ====== WRITING 1 ======
        {
            "title": "Community Service in Schools",
            "chapter": "Chapter 2: Education & Society",
            "type": "writing",
            "content": {
                "task_type": "Task 2 - Opinion Essay",
                "prompt": "Some people believe that unpaid community service should be a compulsory part of high school programmes. To what extent do you agree or disagree?",
                "tips": [
                    "Give reasons for your answer and include any relevant examples.",
                    "Write at least 250 words.",
                    "Structure your essay with a clear introduction, body paragraphs, and conclusion."
                ]
            },
            "questions": []
        },

        # ====== WRITING 2 ======
        {
            "title": "Technology and Social Interaction",
            "chapter": "Chapter 4: Technology & Communication",
            "type": "writing",
            "content": {
                "task_type": "Task 2 - Discussion Essay",
                "prompt": "Some people think that the increasing use of technology has a negative impact on face-to-face communication. Others believe technology enhances our ability to connect. Discuss both views and give your own opinion.",
                "tips": [
                    "Present both sides of the argument before stating your opinion.",
                    "Use specific examples to support your points.",
                    "Write at least 250 words."
                ]
            },
            "questions": []
        },

        # ====== LISTENING 1 ======
        {
            "title": "A Campus Tour",
            "chapter": "Chapter 5: Academic Life",
            "type": "listening",
            "content": {
                "transcript": "Welcome everyone to Greenfield University. I'm Sarah, your student guide for today. We'll begin our tour at the main library, which was recently renovated and now boasts over 2 million books and digital resources. The library is open 24 hours during exam periods. Next, we'll visit the science complex, which houses 15 state-of-the-art laboratories. The complex was completed in 2019 at a cost of 45 million dollars. Our final stop will be the student union building, where you'll find the cafeteria, a bookshop, the student services office, and various club meeting rooms. The university currently has over 200 student clubs and societies.",
                "paragraphs": [
                    {"id": "p1", "text": "Listen to the audio recording of a campus tour at Greenfield University. Then answer the questions below."}
                ]
            },
            "questions": [
                {"type": "multiple_choice", "question_text": "What is the name of the university?", "options": {"A": "Greenville University", "B": "Greenfield University", "C": "Greenwood University", "D": "Greenland University"}, "correct_answer": "B"},
                {"type": "multiple_choice", "question_text": "Who is leading the tour?", "options": {"A": "A professor", "B": "The dean", "C": "A student guide named Sarah", "D": "An administrator"}, "correct_answer": "C"},
                {"type": "multiple_choice", "question_text": "When is the library open 24 hours?", "options": {"A": "Always", "B": "During weekends", "C": "During exam periods", "D": "During summer"}, "correct_answer": "C"},
                {"type": "multiple_choice", "question_text": "How many laboratories does the science complex have?", "options": {"A": "10", "B": "12", "C": "15", "D": "20"}, "correct_answer": "C"},
                {"type": "multiple_choice", "question_text": "When was the science complex completed?", "options": {"A": "2017", "B": "2018", "C": "2019", "D": "2020"}, "correct_answer": "C"},
                {"type": "multiple_choice", "question_text": "What is NOT found in the student union building?", "options": {"A": "Cafeteria", "B": "Swimming pool", "C": "Bookshop", "D": "Club meeting rooms"}, "correct_answer": "B"},
                {"type": "fill_blank", "question_text": "The library has over _______ million books.", "options": {}, "correct_answer": "2"},
                {"type": "fill_blank", "question_text": "The university has over _______ student clubs and societies.", "options": {}, "correct_answer": "200"}
            ]
        },

        # ====== LISTENING 2 ======
        {
            "title": "Hotel Booking Conversation",
            "chapter": "Chapter 6: Travel & Tourism",
            "type": "listening",
            "content": {
                "transcript": "Good morning, Sunrise Hotel, how can I help you? Hi, I'd like to book a room please. Certainly. When would you like to stay? From the 15th to the 18th of March. That's 3 nights. We have standard rooms at 85 dollars per night, and deluxe rooms with a sea view at 120 dollars per night. Both include breakfast. I'll take the deluxe room please. And could I also book airport transfer? Of course. The shuttle runs every 30 minutes and costs 25 dollars one way. My flight arrives at 2:30 PM. Perfect, we'll arrange a pickup for you. Could I have your name please? It's James Patterson, P-A-T-T-E-R-S-O-N. Thank you Mr. Patterson. Your booking reference is HB-7742.",
                "paragraphs": [
                    {"id": "p1", "text": "Listen to a phone conversation between a guest and a hotel receptionist. Then answer the questions below."}
                ]
            },
            "questions": [
                {"type": "multiple_choice", "question_text": "What is the name of the hotel?", "options": {"A": "Sunset Hotel", "B": "Sunrise Hotel", "C": "Starlight Hotel", "D": "Seaside Hotel"}, "correct_answer": "B"},
                {"type": "multiple_choice", "question_text": "How many nights will the guest stay?", "options": {"A": "2", "B": "3", "C": "4", "D": "5"}, "correct_answer": "B"},
                {"type": "multiple_choice", "question_text": "How much does a deluxe room cost per night?", "options": {"A": "$85", "B": "$95", "C": "$110", "D": "$120"}, "correct_answer": "D"},
                {"type": "multiple_choice", "question_text": "What does the room price include?", "options": {"A": "Lunch", "B": "Dinner", "C": "Breakfast", "D": "All meals"}, "correct_answer": "C"},
                {"type": "multiple_choice", "question_text": "How often does the airport shuttle run?", "options": {"A": "Every 15 minutes", "B": "Every 30 minutes", "C": "Every 45 minutes", "D": "Every hour"}, "correct_answer": "B"},
                {"type": "multiple_choice", "question_text": "What time does the guest's flight arrive?", "options": {"A": "1:30 PM", "B": "2:00 PM", "C": "2:30 PM", "D": "3:00 PM"}, "correct_answer": "C"},
                {"type": "fill_blank", "question_text": "The guest's surname is _______.", "options": {}, "correct_answer": "Patterson"},
                {"type": "fill_blank", "question_text": "The booking reference number is HB-_______.", "options": {}, "correct_answer": "7742"}
            ]
        },

        # ====== SPEAKING 1 ======
        {
            "title": "Speaking Task 2: Describe a memorable journey",
            "chapter": "Chapter 7: Speaking Practice",
            "type": "speaking",
            "content": {
                "prompt": "Describe a memorable journey you have made.\nYou should say:\n- where you went\n- how you traveled\n- why you went on the journey\nand explain why you remember this journey so well.\n\nYou will have to talk about the topic for one to two minutes. You have one minute to think about what you are going to say. You can make some notes to help you if you wish."
            },
            "questions": []
        }
    ]

    for lesson_data in lessons_data:
        existing = db.query(models.Lesson).filter(models.Lesson.title == lesson_data["title"]).first()
        if existing:
            # Update existing lesson with more questions if needed
            existing_q_count = db.query(models.Question).filter(models.Question.lesson_id == existing.id).count()
            new_q_count = len(lesson_data.get("questions", []))
            if new_q_count > existing_q_count:
                # Delete old questions and re-insert
                db.query(models.Question).filter(models.Question.lesson_id == existing.id).delete()
                for q_data in lesson_data["questions"]:
                    question = models.Question(lesson_id=existing.id, **q_data)
                    db.add(question)
                print(f"  [updated] {lesson_data['title']}: {existing_q_count} -> {new_q_count} questions")
            else:
                print(f"  [skip] Lesson already exists: {lesson_data['title']} ({existing_q_count} questions)")
            continue

        questions_data = lesson_data.pop("questions", [])
        lesson = models.Lesson(**lesson_data)
        db.add(lesson)
        db.flush()

        for q_data in questions_data:
            question = models.Question(lesson_id=lesson.id, **q_data)
            db.add(question)

        print(f"  [ok] Seeded lesson: {lesson_data['title']} ({len(questions_data)} questions)")

    # Seed initial assignments
    coach = db.query(models.User).filter(models.User.username == "coach").first()
    student1 = db.query(models.User).filter(models.User.username == "student1").first()
    student2 = db.query(models.User).filter(models.User.username == "student2").first()
    lesson1 = db.query(models.Lesson).filter(models.Lesson.title == "IELTS Reading: Nutmeg - a valuable spice").first()
    lesson2 = db.query(models.Lesson).filter(models.Lesson.title == "IELTS Reading: Driverless cars").first()
    
    if coach and student1 and student2 and lesson1 and lesson2:
        assignments = [
            {"coach_id": coach.id, "student_id": student1.id, "lesson_id": lesson1.id, "status": "pending"},
            {"coach_id": coach.id, "student_id": student1.id, "lesson_id": lesson2.id, "status": "pending"},
            {"coach_id": coach.id, "student_id": student2.id, "lesson_id": lesson1.id, "status": "pending"}
        ]
        
        for a_data in assignments:
            existing_a = db.query(models.Assignment).filter(
                models.Assignment.student_id == a_data["student_id"],
                models.Assignment.lesson_id == a_data["lesson_id"]
            ).first()
            if not existing_a:
                db.add(models.Assignment(**a_data))
                print(f"  [ok] Assigned lesson {a_data['lesson_id']} to student {a_data['student_id']}")

    db.commit()


if __name__ == "__main__":
    print("\n[SEED] LWAC Data Seeder v2")
    print("=" * 40)

    print("\n[1/2] Seeding Users...")
    seed_users()

    print("\n[2/2] Seeding IELTS Lessons...")
    seed_lessons()

    print("\n[DONE] Database seeded successfully!")
    print(f"   Lessons: {db.query(models.Lesson).count()}")
    print(f"   Questions: {db.query(models.Question).count()}")
    print(f"   Users: {db.query(models.User).count()}")

    db.close()
