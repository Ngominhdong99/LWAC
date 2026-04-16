import json
from pathlib import Path

from models import VocabularyEntry


DATA_FILE = Path(__file__).resolve().parent / "vocabulary_entries.json"


def load_master_vocabulary_entries() -> list[dict]:
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def seed_master_vocabulary(db) -> int:
    if db.query(VocabularyEntry).count() > 0:
        return 0

    for entry in load_master_vocabulary_entries():
        db.add(VocabularyEntry(**entry))
    db.commit()
    return db.query(VocabularyEntry).count()
