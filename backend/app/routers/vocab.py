from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/vocab",
    tags=["vocab"]
)

@router.get("/{user_id}", response_model=List[schemas.VocabVaultResponse])
def read_vocab(user_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    vocab = db.query(models.VocabVault).filter(models.VocabVault.user_id == user_id).offset(skip).limit(limit).all()
    return vocab

@router.post("/{user_id}", response_model=schemas.VocabVaultResponse)
def create_vocab(user_id: int, vocab: schemas.VocabVaultCreate, db: Session = Depends(get_db)):
    # Verify user exists first
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    db_vocab = models.VocabVault(**vocab.dict(), user_id=user_id)
    db.add(db_vocab)
    db.commit()
    db.refresh(db_vocab)
    return db_vocab

@router.delete("/{vocab_id}")
def delete_vocab(vocab_id: int, db: Session = Depends(get_db)):
    db_vocab = db.query(models.VocabVault).filter(models.VocabVault.id == vocab_id).first()
    if not db_vocab:
        raise HTTPException(status_code=404, detail="Vocabulary item not found")
    
    db.delete(db_vocab)
    db.commit()
    return {"message": "Vocabulary item deleted successfully"}
