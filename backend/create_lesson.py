import requests, json

API = 'https://minhdong-edu.io.vn/api'

# Create lesson
lesson_data = {
    'title': 'Present Simple Tense - Exercises',
    'chapter': 'Grammar',
    'type': 'reading',
    'content': {
        'passage': """THE PRESENT SIMPLE TENSE

The Present Simple tense is one of the most fundamental grammar structures in English. It is used to describe habits, routines, general truths, and fixed schedules.

FORMATION RULES:
For affirmative sentences, we use the base form of the verb. With third-person singular subjects (he, she, it), we add -s or -es to the verb. For example: "I play tennis every weekend" but "She plays tennis every weekend."

For negative sentences, we use "do not" (don't) or "does not" (doesn't) before the base verb. For example: "I don't like coffee" and "He doesn't like coffee." Note that when using "doesn't," the main verb returns to its base form without -s.

For questions, we place "Do" or "Does" before the subject. For example: "Do you speak French?" and "Does she speak French?"

USAGE:
1. Habits and routines: "I usually get up at 6 a.m." - Signal words include: always, usually, often, sometimes, rarely, never, every day, once a week.
2. General truths and facts: "The Earth moves around the Sun." - These are things that are always true.
3. Fixed schedules and timetables: "The plane lands at 10 a.m. tomorrow." - Even though the event is in the future, we use Present Simple because it is a fixed schedule.
4. First conditional sentences: "If I pass this exam, my parents will take me to London." - The if-clause uses Present Simple.

SPELLING RULES FOR THIRD PERSON SINGULAR:
- Most verbs: add -s (show - shows, drink - drinks)
- Verbs ending in -o, -ch, -sh, -x, -s: add -es (go - goes, watch - watches, wash - washes)
- Verbs ending in consonant + y: change y to -ies (study - studies, copy - copies)
- Verbs ending in vowel + y: just add -s (play - plays, say - says)"""
    }
}

r = requests.post(f'{API}/lessons/', json=lesson_data)
print('Create lesson status:', r.status_code)
lesson = r.json()
lesson_id = lesson['id']
print(f'Lesson ID: {lesson_id}')

# Create questions - mix of written_answer and multiple_choice
questions = [
    {'type': 'written_answer', 'question_text': 'My brother always ______ Saturday dinner.', 'options': None, 'correct_answer': 'makes'},
    {'type': 'written_answer', 'question_text': 'Ruth ______ eggs; they make her ill. (Use negative form)', 'options': None, 'correct_answer': "doesn't eat|does not eat"},
    {'type': 'written_answer', 'question_text': '"Have you got a lighter?" "Sorry, I ______." (Use negative form)', 'options': None, 'correct_answer': "don't smoke|do not smoke"},
    {'type': 'written_answer', 'question_text': '______ Mark ______ to school every day? (Write the full question form)', 'options': None, 'correct_answer': 'Does Mark go'},
    {'type': 'written_answer', 'question_text': '______ your parents ______ your boyfriend? (Write the full question form)', 'options': None, 'correct_answer': 'Do your parents like'},
    {'type': 'written_answer', 'question_text': 'How often ______ you ______ hiking? (Fill in the two missing auxiliary and main verbs)', 'options': None, 'correct_answer': 'do go|do / go|do you go'},
    {'type': 'written_answer', 'question_text': 'Where ______ your sister ______? (Fill in the two missing auxiliary and main verbs)', 'options': None, 'correct_answer': 'does work|does / work|does your sister work'},
    {'type': 'written_answer', 'question_text': "Ann usually ______ lunch. (Use negative form)", 'options': None, 'correct_answer': "doesn't have|does not have|doesn't usually have"},
    {'type': 'written_answer', 'question_text': 'Who ______ the ironing in your house?', 'options': None, 'correct_answer': 'does'},
    {'type': 'written_answer', 'question_text': 'We ______ out once a week.', 'options': None, 'correct_answer': 'hang'},
    {'type': 'multiple_choice', 'question_text': "My friend is finding life in Paris difficult. He ______ French.", 'options': {'A': "doesn't speak", 'B': "don't speak", 'C': "isn't speaking", 'D': 'not speaks'}, 'correct_answer': 'A'},
    {'type': 'multiple_choice', 'question_text': 'Most students live close to the college, so they ______ there every day.', 'options': {'A': 'drive', 'B': 'fly', 'C': 'walk', 'D': 'run'}, 'correct_answer': 'C'},
    {'type': 'multiple_choice', 'question_text': "I've got four cats and two dogs. I ______ animals.", 'options': {'A': 'hate', 'B': 'love', 'C': 'dislike', 'D': 'fear'}, 'correct_answer': 'B'},
    {'type': 'written_answer', 'question_text': "No breakfast for Mark, thanks. He ______ breakfast. (Use negative form)", 'options': None, 'correct_answer': "doesn't eat|does not eat"},
    {'type': 'written_answer', 'question_text': "Don't try to ring the bell. It ______. (Use negative form)", 'options': None, 'correct_answer': "doesn't work|does not work"},
    {'type': 'multiple_choice', 'question_text': 'Matthew is good at basketball. He ______ every game.', 'options': {'A': 'loses', 'B': 'wins', 'C': 'plays', 'D': 'watches'}, 'correct_answer': 'B'},
    {'type': 'written_answer', 'question_text': "We always travel by bus. We ______ a car. (Use negative form)", 'options': None, 'correct_answer': "don't own|do not own"},
    {'type': 'multiple_choice', 'question_text': 'The Earth ______ around the Sun.', 'options': {'A': 'moved', 'B': 'moves', 'C': 'will move', 'D': 'is moving'}, 'correct_answer': 'B'},
    {'type': 'multiple_choice', 'question_text': 'The plane ______ at 10 a.m. tomorrow.', 'options': {'A': 'will land', 'B': 'landed', 'C': 'lands', 'D': 'is landing'}, 'correct_answer': 'C'},
    {'type': 'multiple_choice', 'question_text': 'If I ______ this exam, my parents will take me to London.', 'options': {'A': 'pass', 'B': 'passed', 'C': 'will pass', 'D': 'am passing'}, 'correct_answer': 'A'},
]

r2 = requests.post(f'{API}/lessons/{lesson_id}/questions/bulk', json=questions)
print('Create questions status:', r2.status_code)
data = r2.json()
print(f'Created {len(data)} questions')
print(f'SUCCESS! Lesson URL: https://minhdong-edu.io.vn/reading/{lesson_id}')
