"""add role to itinerary_members

Revision ID: c3b4a5f6e7d8
Revises: b2a3f4e5d6c7
Create Date: 2026-07-19 00:00:03.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3b4a5f6e7d8'
down_revision: Union[str, Sequence[str], None] = 'b2a3f4e5d6c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'itinerary_members',
        sa.Column('role', sa.String(length=20), nullable=False, server_default='editor'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('itinerary_members', 'role')
