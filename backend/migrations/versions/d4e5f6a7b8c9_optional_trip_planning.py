"""Optional trip assistance, without altering existing itinerary records."""
from alembic import op
import sqlalchemy as sa

revision = "d4e5f6a7b8c9"
down_revision = "c3b4a5f6e7d8"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "itinerary_planning",
        sa.Column("itinerary_id", sa.Integer(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["itinerary_id"], ["itineraries.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("itinerary_id"),
    )
    if op.get_bind().dialect.name == "postgresql":
        # Planning records are accessed through authenticated FastAPI routes only.
        op.execute("ALTER TABLE itinerary_planning ENABLE ROW LEVEL SECURITY")


def downgrade():
    op.drop_table("itinerary_planning")
