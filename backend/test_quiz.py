import urllib.request
import json

url = 'http://127.0.0.1:8000/quiz/submit/writing'
data = {
    'user_id': 1,
    'lesson_id': 1,
    'question_text': 'Is unpaid community service good?',
    'user_response': 'I completely agree. It is good for people.'
}
req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'}, method='POST')

try:
    with urllib.request.urlopen(req) as response:
        result = response.read().decode('utf-8')
        print("Success:", result)
except Exception as e:
    print("Error:", e)
    if hasattr(e, 'read'):
        print(e.read().decode('utf-8'))
