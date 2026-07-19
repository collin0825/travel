"""add transport fields to itinerary_items

Revision ID: a1f2e3d4c5b6
Revises: 099298e65e3a
Create Date: 2026-07-19 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1f2e3d4c5b6'
down_revision: Union[str, Sequence[str], None] = '099298e65e3a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('itinerary_items', sa.Column('transport_mode', sa.String(length=20), nullable=True))
    op.add_column('itinerary_items', sa.Column('transport_note', sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('itinerary_items', 'transport_note')
    op.drop_column('itinerary_items', 'transport_mode')
