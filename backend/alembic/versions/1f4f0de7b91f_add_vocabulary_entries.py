"""add_vocabulary_entries

Revision ID: 1f4f0de7b91f
Revises: 644db7dbcce9
Create Date: 2026-04-10 00:00:00.000000

"""

from pathlib import Path
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "1f4f0de7b91f"
down_revision: Union[str, Sequence[str], None] = "644db7dbcce9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "vocabulary_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("word", sa.String(), nullable=False),
        sa.Column("meaning", sa.String(), nullable=False),
        sa.Column("ipa", sa.String(), nullable=True),
        sa.Column("part_of_speech", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("vocabulary_entries", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_vocabulary_entries_id"), ["id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_vocabulary_entries_word"), ["word"], unique=True
        )

    table = sa.table(
        "vocabulary_entries",
        sa.column("word", sa.String()),
        sa.column("meaning", sa.String()),
        sa.column("ipa", sa.String()),
        sa.column("part_of_speech", sa.String()),
        sa.column("is_active", sa.Boolean()),
    )
    data_file = (
        Path(__file__).resolve().parents[2] / "data" / "vocabulary_entries.json"
    )
    entries = json.loads(data_file.read_text(encoding="utf-8"))
    op.bulk_insert(
        table,
        [
            {
                "word": entry["word"],
                "meaning": entry["meaning"],
                "ipa": entry.get("ipa"),
                "part_of_speech": entry.get("part_of_speech"),
                "is_active": True,
            }
            for entry in entries
        ],
    )


def downgrade() -> None:
    with op.batch_alter_table("vocabulary_entries", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_vocabulary_entries_word"))
        batch_op.drop_index(batch_op.f("ix_vocabulary_entries_id"))

    op.drop_table("vocabulary_entries")
