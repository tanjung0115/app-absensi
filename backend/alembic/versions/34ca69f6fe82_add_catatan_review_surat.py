"""add_catatan_review_surat

Revision ID: 34ca69f6fe82
Revises: 79556dce616e
Create Date: 2026-03-21 23:35:50.152760

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '34ca69f6fe82'
down_revision: Union[str, Sequence[str], None] = '79556dce616e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    column_names = {col["name"] for col in inspector.get_columns("surat_keterangan")}

    if "catatan_review" not in column_names:
        op.add_column('surat_keterangan', sa.Column('catatan_review', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    column_names = {col["name"] for col in inspector.get_columns("surat_keterangan")}

    if "catatan_review" in column_names:
        op.drop_column('surat_keterangan', 'catatan_review')
