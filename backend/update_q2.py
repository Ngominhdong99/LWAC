import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('103.121.91.177', 26266, 'root', 'Md01100100@')

script_content = '''import sys
import os

# Ensure we can import from app
sys.path.append("/opt/LWAC/backend")

from app.database import SessionLocal
from app import models

db = SessionLocal()
try:
    lessons = db.query(models.Lesson).all()
    for l in lessons:
        if "Present Simple" in l.title:
            print(f"[{l.id}] {l.title} (Type: {l.type})")
            questions = db.query(models.Question).filter(models.Question.lesson_id == l.id).order_by(models.Question.id).all()
            print(f"  Questions count: {len(questions)}")
            for idx, q in enumerate(questions[:3]): # print first 3
                print(f"  Q{idx+1} (ID {q.id}): {q.question_text} -> {q.correct_answer}")
            
            # If this is the lesson with questions, update Q2
            if len(questions) >= 2:
                q2 = questions[1]
                q2.question_text = "Ruth (not eat) ______ eggs; they (make) ______ her ill."
                q2.correct_answer = "doesn't eat|does not eat ; make"
                db.commit()
                print(f"Updated Lesson {l.id} Q2 to multi-blank!")

except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()
'''

sftp = client.open_sftp()
with sftp.open('/tmp/find_lesson.py', 'w') as f:
    f.write(script_content)
sftp.close()

stdin, stdout, stderr = client.exec_command('cd /opt/LWAC/backend && /opt/LWAC/backend/venv/bin/python /tmp/find_lesson.py')
exit_code = stdout.channel.recv_exit_status()
print(stdout.read().decode())
err = stderr.read().decode()
if err:
    print('ERR:', err)
client.close()
