from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import schemas
from app.api.deps import get_current_user
from app.api.permissions import require_editor
from app.db import models
from app.db.session import get_db
from app.websocket import manager

router = APIRouter(prefix="/api/itineraries", tags=["items"])


@router.post("/{itinerary_id}/items", response_model=schemas.ItineraryItemResponse)
async def create_itinerary_item(
    itinerary_id: int,
    item_in: schemas.ItineraryItemCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_editor(db, itinerary_id, current_user)

    day_items = (
        db.query(models.ItineraryItem)
        .filter(
            models.ItineraryItem.itinerary_id == itinerary_id,
            models.ItineraryItem.day_number == item_in.day_number,
        )
        .order_by(models.ItineraryItem.sort_order)
        .all()
    )

    # A timed item slots in before the first later-timed item; untimed items
    # (and timeless new items) keep append-to-end behavior.
    insert_at = None
    if item_in.time:
        for index, existing in enumerate(day_items):
            if existing.time and existing.time > item_in.time:
                insert_at = index
                break

    if insert_at is not None:
        sort_order = day_items[insert_at].sort_order
        for existing in day_items[insert_at:]:
            existing.sort_order += 1
    else:
        sort_order = day_items[-1].sort_order + 1 if day_items else 0

    new_item = models.ItineraryItem(
        itinerary_id=itinerary_id,
        day_number=item_in.day_number,
        name=item_in.name,
        description=item_in.description,
        address=item_in.address,
        latitude=item_in.latitude,
        longitude=item_in.longitude,
        time=item_in.time,
        transport_mode=item_in.transport_mode,
        transport_note=item_in.transport_note,
        cost=item_in.cost,
        sort_order=sort_order,
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)

    await manager.broadcast_to_room(itinerary_id, {"type": "refresh_itinerary"})
    return new_item


@router.put("/items/{item_id}", response_model=schemas.ItineraryItemResponse)
async def update_itinerary_item(
    item_id: int,
    item_in: schemas.ItineraryItemUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(models.ItineraryItem).filter(models.ItineraryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    itinerary = require_editor(db, item.itinerary_id, current_user)

    item.day_number = item_in.day_number
    item.name = item_in.name
    item.description = item_in.description
    item.address = item_in.address
    item.latitude = item_in.latitude
    item.longitude = item_in.longitude
    item.time = item_in.time
    item.transport_mode = item_in.transport_mode
    item.transport_note = item_in.transport_note
    item.cost = item_in.cost
    item.sort_order = item_in.sort_order

    db.commit()
    db.refresh(item)

    await manager.broadcast_to_room(itinerary.id, {"type": "refresh_itinerary"})
    return item


@router.delete("/items/{item_id}")
async def delete_itinerary_item(
    item_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(models.ItineraryItem).filter(models.ItineraryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    itinerary = require_editor(db, item.itinerary_id, current_user)

    db.delete(item)
    db.commit()

    await manager.broadcast_to_room(itinerary.id, {"type": "refresh_itinerary"})
    return {"status": "success"}


@router.put("/{itinerary_id}/items/reorder")
async def reorder_itinerary_items(
    itinerary_id: int,
    reorder_in: schemas.ItemsReorderRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_editor(db, itinerary_id, current_user)

    for day in reorder_in.days:
        for index, item_id in enumerate(day.item_ids):
            db.query(models.ItineraryItem).filter(
                models.ItineraryItem.id == item_id,
                models.ItineraryItem.itinerary_id == itinerary_id,
            ).update({"day_number": day.day_number, "sort_order": index})

    db.commit()
    await manager.broadcast_to_room(itinerary_id, {"type": "refresh_itinerary"})
    return {"status": "success"}
