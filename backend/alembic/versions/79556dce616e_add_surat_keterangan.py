"""add_surat_keterangan

Revision ID: 79556dce616e
Revises: 11115b739aa2
Create Date: 2026-03-21 23:20:25.450706

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '79556dce616e'
down_revision: Union[str, Sequence[str], None] = '11115b739aa2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'surat_keterangan' not in inspector.get_table_names():
        op.create_table('surat_keterangan',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('tanggal', sa.Date(), nullable=False),
        sa.Column('jenis', sa.String(), nullable=False),
        sa.Column('keterangan', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_surat_keterangan_id'), 'surat_keterangan', ['id'], unique=False)
        op.create_index(op.f('ix_surat_keterangan_tanggal'), 'surat_keterangan', ['tanggal'], unique=False)
        op.create_index(op.f('ix_surat_keterangan_user_id'), 'surat_keterangan', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'surat_keterangan' in inspector.get_table_names():
        op.drop_index(op.f('ix_surat_keterangan_user_id'), table_name='surat_keterangan')
        op.drop_index(op.f('ix_surat_keterangan_tanggal'), table_name='surat_keterangan')
        op.drop_index(op.f('ix_surat_keterangan_id'), table_name='surat_keterangan')
        op.drop_table('surat_keterangan')
