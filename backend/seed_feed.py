"""Seed the Hi Again feed with viral-style missed-connection stories.

Each post:
- Written in original viral-Reddit / Twitter-thread tone
- Uses a legally-licensed Unsplash photo (CC0 / Unsplash license)
- Attributed to seed accounts we create automatically
- Marked with `is_seed: True` so we can nuke them later if needed
"""
import asyncio
import os
import uuid
import hashlib
import requests
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "hiagain"

# Real viral missed-connection stories written from scratch in that tone.
# Each has: (author_name, city, event, story, unsplash_photo_id)
# Unsplash photo IDs are public URLs anyone can hotlink under Unsplash license.
POSTS = [
    ("Maya", "Brooklyn", "L train, 8:47 AM",
     "you were reading a book about grief on the L train tuesday morning. i almost asked what page you were on. i've been on page 47 for a month.",
     "https://images.unsplash.com/photo-1519681393784-d120267933ba"),
    ("Jordan", "Austin", "ACL Festival — night one",
     "you asked me to hold your beer during phoebe bridgers. i still have it. still cold. still waiting.",
     "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3"),
    ("Ana", "Miami", "Wynwood coffee shop",
     "you left your notebook. i didn't open it. but i sat with it for 40 minutes hoping you'd come back. you didn't. it's still with me.",
     "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085"),
    ("Marcus", "Denver", "Red Rocks, September 12",
     "we were both wearing red. we made eye contact 3 times during ODESZA. the fourth time i lost you in the crowd. still looking.",
     "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f"),
    ("Sana", "Portland", "Powell's Books, sci-fi section",
     "you recommended dune. i said i'd read it. i did. i want to talk about it. i can't find you.",
     "https://images.unsplash.com/photo-1512820790803-83ca734da794"),
    ("Devon", "NYC", "JFK → LAX red-eye",
     "seat 27B. you slept on my shoulder for 4 hours. neither of us apologized. we just walked off in different directions.",
     "https://images.unsplash.com/photo-1436491865332-7a61a109cc05"),
    ("Riley", "Chicago", "The Bean, October",
     "you were with a friend. you took a photo of me. you thought i didn't notice. i did.",
     "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df"),
    ("Emmy", "Seattle", "Pike Place fish market",
     "you laughed when they threw the salmon. it was the best laugh i've heard all year. i didn't say anything.",
     "https://images.unsplash.com/photo-1516214104703-d870798883c5"),
    ("Zoe", "Nashville", "Bluebird Cafe",
     "you knew every word to the third song. i watched you the entire time. sorry not sorry.",
     "https://images.unsplash.com/photo-1516280440614-37939bbacd81"),
    ("Alex", "Boston", "Fenway, section 34",
     "hot dog guy. red sox down 3. you turned to me and said 'we're not losing tonight.' we lost. but you were right about the important part.",
     "https://images.unsplash.com/photo-1566577739112-5180d4bf9390"),
    ("Priya", "San Francisco", "Golden Gate at sunset",
     "you were taking a photo of the fog. i offered to take one with you in it. you said no. i've regretted it every day since.",
     "https://images.unsplash.com/photo-1449034446853-66c86144b0ad"),
    ("Kai", "LA", "Runyon Canyon, 6am hike",
     "your dog jumped on me. you apologized. i wanted to say don't. i miss both of you.",
     "https://images.unsplash.com/photo-1544568100-847a948585b9"),
    ("Nadia", "Atlanta", "Ponce City Market, food hall",
     "you ordered the same thing as me at 3 different stalls in a row. we didn't say anything. i think we should have.",
     "https://images.unsplash.com/photo-1555396273-367ea4eb4db5"),
    ("Sam", "Vegas", "Bellagio fountains, midnight",
     "you were crying. i pretended not to notice because i thought that's what you'd want. i've been thinking about it for two years.",
     "https://images.unsplash.com/photo-1506905925346-21bda4d32df4"),
    ("Layla", "New Orleans", "Frenchmen St, Friday night",
     "we danced next to each other for two songs. you looked at me during the sax solo. i looked away. i'm sorry i looked away.",
     "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3"),
]


_storage_key = None
def storage_key():
    global _storage_key
    if _storage_key: return _storage_key
    r = requests.post(f"{STORAGE_URL}/init",
                      json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    r.raise_for_status()
    _storage_key = r.json()["storage_key"]
    return _storage_key


def cache_image(unsplash_url: str) -> tuple[bytes, str]:
    # Ask Unsplash for a 1080-wide crop (URL param).
    url = f"{unsplash_url}?auto=format&fit=crop&w=1080&q=80"
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "image/jpeg")


def upload(content: bytes, content_type: str, user_id: str) -> str:
    ext = "jpg" if "jpeg" in content_type else "png"
    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/post/{user_id}/{file_id}.{ext}"
    r = requests.put(f"{STORAGE_URL}/objects/{path}",
                     headers={"X-Storage-Key": storage_key(), "Content-Type": content_type},
                     data=content, timeout=120)
    r.raise_for_status()
    j = r.json()
    return file_id, j["path"], j.get("size", len(content))


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    now = datetime.now(timezone.utc)
    created_users = 0
    created_posts = 0

    for i, (author, city, event, story, photo_url) in enumerate(POSTS):
        # Stable synthetic user id derived from name so we don't dupe on re-run
        user_id = "seed-" + hashlib.sha1(author.encode()).hexdigest()[:12]
        email = f"{author.lower()}@stories.hiagain.xyz"
        existing = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not existing:
            await db.users.insert_one({
                "id": user_id,
                "email": email,
                "name": author,
                "password_hash": "$seed$",  # unusable
                "created_at": (now - timedelta(days=(15 - i))).isoformat(),
                "ghost_mode": True,          # never surfaces in crossings
                "email_verified": True,
                "onboarded": True,
                "is_seed": True,
                "subscription_tier": "free",
                "bio": "just crossing paths.",
            })
            created_users += 1

        story_id = "seedpost-" + hashlib.sha1((author + story).encode()).hexdigest()[:16]

        # Skip fully-populated existing story; otherwise back-fill fields.
        existing_post = await db.posts.find_one({"id": story_id}, {"_id": 0})
        if existing_post and existing_post.get("caption") and existing_post.get("media_url"):
            continue

        # Fetch + upload photo to object storage (unless we already have one)
        media_url = existing_post.get("media_url") if existing_post else None
        if not media_url:
            try:
                content, ct = cache_image(photo_url)
                file_id, storage_path, size = upload(content, ct, user_id)
                await db.media_files.insert_one({
                    "id": file_id, "user_id": user_id,
                    "storage_path": storage_path, "content_type": ct,
                    "size": size, "media_type": "post",
                    "is_deleted": False, "is_seed": True,
                    "created_at": now.isoformat(),
                })
                media_url = f"/api/media/{file_id}"
            except Exception as e:
                print(f"  ⚠️ {author}: image failed ({e}), posting text-only")
                media_url = None

        posted_at = (now - timedelta(hours=(i * 5 + 2))).isoformat()
        doc = {
            "id": story_id,
            "user_id": user_id,
            "user_name": author,
            "user_photo": None,
            "caption": story,
            "content": story,  # kept for legacy readers
            "media_url": media_url,
            "media_type": "image" if media_url else None,
            "location": f"{event} · {city}",
            "city": city,
            "event_or_place": event,
            "is_private": False,
            "removed": False,
            "likes": [],
            "likes_count": (i * 47 + 89) % 500,  # cosmetic
            "comments_count": (i * 13 + 7) % 40,
            "created_at": (existing_post or {}).get("created_at") or posted_at,
            "is_seed": True,
        }
        await db.posts.update_one({"id": story_id}, {"$set": doc}, upsert=True)
        created_posts += 1
        print(f"  ✅ {author} in {city}")

    print(f"\n━━━ DONE ━━━")
    print(f"  Seed users created: {created_users}")
    print(f"  Seed posts created: {created_posts}")
    print(f"  Total posts in DB now: {await db.posts.count_documents({})}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
