"""renumber sort_order to match time display order

The UI previously sorted items by time (nulls last, sort_order as tiebreak)
while sort_order held creation order. Now that sort_order becomes the display
source of truth, renumber existing rows to match what users have been seeing.

Revision ID: b2a3f4e5d6c7
Revises: a1f2e3d4c5b6
Create Date: 2026-07-19 00:00:02.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2a3f4e5d6c7'
down_revision: Union[str, Sequence[str], None] = 'a1f2e3d4c5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    rows = conn.execute(
        sa.text('SELECT id, itinerary_id, day_number, time, sort_order FROM itinerary_items')
    ).fetchall()

    groups: dict[tuple[int, int], list] = {}
    for row in rows:
        groups.setdefault((row.itinerary_id, row.day_number), []).append(row)

    for day_rows in groups.values():
        day_rows.sort(key=lambda r: (r.time is None, r.time or '', r.sort_order))
        for index, row in enumerate(day_rows):
            if row.sort_order != index:
                conn.execute(
                    sa.text('UPDATE itinerary_items SET sort_order = :so WHERE id = :id'),
                    {'so': index, 'id': row.id},
                )


def downgrade() -> None:
    """Downgrade schema."""
    # Data-only migration; original creation-order numbering is not recoverable.
    pass
