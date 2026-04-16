from fastapi import Depends, Response, status

from database import get_db
from exceptions import NotFoundError
from models import VocabVault
from . import schemas as vocab_schemas


def list_vocab(db, user_id, skip=0, limit=100):
    return (
        db.query(VocabVault)
        .filter(VocabVault.user_id == user_id)
        .offset(skip)
        .limit(limit)
        .all()
    )


def create_vocab(db, user_id, **kwargs):
    v = VocabVault(user_id=user_id, **kwargs)
    db.add(v)
    return v


def bulk_import_vocab(db, user_id, words_list):
    """Bulk import vocabulary entries."""
    created = []
    for entry in words_list:
        v = VocabVault(user_id=user_id, **entry)
        db.add(v)
        created.append(v)
    return created


def delete_vocab(db, vocab_id):
    v = db.query(VocabVault).filter(VocabVault.id == vocab_id).first()
    if not v:
        raise NotFoundError("Vocabulary item not found")
    db.delete(v)


def read_vocab(user_id: int, skip: int = 0, limit: int = 100, db=Depends(get_db)):
    return list_vocab(db, user_id=user_id, skip=skip, limit=limit)


def create_vocab_route(
    user_id: int, vocab: vocab_schemas.VocabCreate, db=Depends(get_db)
):
    db_vocab = create_vocab(db, user_id=user_id, **vocab.model_dump())
    db.commit()
    db.refresh(db_vocab)
    return db_vocab


def bulk_import_vocab_route(
    user_id: int, words: list[vocab_schemas.VocabCreate], db=Depends(get_db)
):
    created = bulk_import_vocab(db, user_id, [word.model_dump() for word in words])
    db.commit()
    for vocab in created:
        db.refresh(vocab)
    return created


def delete_vocab_route(vocab_id: int, db=Depends(get_db)):
    delete_vocab(db, vocab_id)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
