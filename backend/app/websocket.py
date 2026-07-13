from fastapi import WebSocket
from typing import Dict, List
import json

class ConnectionManager:
    def __init__(self):
        # Maps itinerary_id to a list of WebSockets
        self.rooms: Dict[int, List[WebSocket]] = {}
        # Maps WebSocket to user info dictionary
        self.user_details: Dict[WebSocket, dict] = {}

    async def connect(self, websocket: WebSocket, itinerary_id: int, user_info: dict):
        # Add connection to room
        if itinerary_id not in self.rooms:
            self.rooms[itinerary_id] = []
        self.rooms[itinerary_id].append(websocket)
        
        # Save user details
        self.user_details[websocket] = user_info
        
        # Broadcast updated presence list
        await self.broadcast_presence(itinerary_id)

    async def disconnect(self, websocket: WebSocket, itinerary_id: int):
        if itinerary_id in self.rooms:
            if websocket in self.rooms[itinerary_id]:
                self.rooms[itinerary_id].remove(websocket)
            if not self.rooms[itinerary_id]:
                del self.rooms[itinerary_id]
                
        if websocket in self.user_details:
            del self.user_details[websocket]
            
        # Broadcast updated presence list
        await self.broadcast_presence(itinerary_id)

    async def broadcast_to_room(self, itinerary_id: int, message: dict):
        if itinerary_id in self.rooms:
            message_str = json.dumps(message)
            for connection in self.rooms[itinerary_id]:
                try:
                    await connection.send_text(message_str)
                except Exception:
                    # Ignore broken connections; cleanup will happen on disconnect
                    pass

    async def broadcast_presence(self, itinerary_id: int):
        if itinerary_id in self.rooms:
            # Gather all active users in the room
            active_users = []
            seen_user_ids = set()
            for connection in self.rooms[itinerary_id]:
                details = self.user_details.get(connection)
                if details and details["id"] not in seen_user_ids:
                    active_users.append(details)
                    seen_user_ids.add(details["id"])
                    
            presence_message = {
                "type": "presence",
                "users": active_users
            }
            await self.broadcast_to_room(itinerary_id, presence_message)

manager = ConnectionManager()
