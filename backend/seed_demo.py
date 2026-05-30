"""
Seed Hi Again with demo users, posts, crossings, gatherings.
Run: `cd /app/backend && python3 seed_demo.py`
Idempotent: re-running skips existing demo users.

All demo records are tagged `is_demo: True` so they can be cleaned later with:
    python3 seed_demo.py --wipe
"""
import asyncio
import os
import sys
import uuid
import random
from datetime import datetime, timezone, timedelta

import bcrypt
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

ADMIN_EMAIL = os.environ.get("DEMO_ADMIN_EMAIL", "hiagainxyz@gmail.com")
DEMO_PASSWORD = os.environ.get("DEMO_USER_PASSWORD", "HiAgainDemo2026!")
DEMO_TAG = True  # is_demo field value

# ---------- Demo users -----------------------------------------------------
# Photos: DiceBear (illustrated, CC0) + randomuser.me (CC0 stock faces).
# Mixed intentionally so the feed doesn't look mono-styled.
DEMO_USERS = [
    {"name": "Maya Chen",        "email": "maya.demo@hiagain.xyz",        "city": "San Diego", "bio": "Dog mom, Padres fan, always at Petco Park 🐕",
     "photo": "https://randomuser.me/api/portraits/women/44.jpg"},
    {"name": "Jordan Rivera",    "email": "jordan.demo@hiagain.xyz",      "city": "Miami",     "bio": "Music festival addict. If it's loud, I'm there.",
     "photo": "https://randomuser.me/api/portraits/men/32.jpg"},
    {"name": "Priya Kapoor",     "email": "priya.demo@hiagain.xyz",       "city": "New York",  "bio": "MSG regular. Nets or Rangers, take me out 🏀",
     "photo": "https://randomuser.me/api/portraits/women/68.jpg"},
    {"name": "Sam Okafor",       "email": "sam.demo@hiagain.xyz",         "city": "Austin",    "bio": "Breakfast tacos > everything. SXSW survivor.",
     "photo": "https://randomuser.me/api/portraits/men/75.jpg"},
    {"name": "Luna Vasquez",     "email": "luna.demo@hiagain.xyz",        "city": "Los Angeles","bio": "Echo Park coffee snob. Film nerd.",
     "photo": "https://randomuser.me/api/portraits/women/12.jpg"},
    {"name": "Ethan Brooks",     "email": "ethan.demo@hiagain.xyz",       "city": "Seattle",   "bio": "Rainy day runner. Mariners till I die.",
     "photo": "https://randomuser.me/api/portraits/men/22.jpg"},
    {"name": "Noor Hassan",      "email": "noor.demo@hiagain.xyz",        "city": "San Francisco","bio": "Startup PM by day, Dolores Park by weekend.",
     "photo": "https://randomuser.me/api/portraits/women/90.jpg"},
    {"name": "Kai Tanaka",       "email": "kai.demo@hiagain.xyz",         "city": "Chicago",   "bio": "Lincoln Park runner. Cubs optimist.",
     "photo": "https://randomuser.me/api/portraits/men/47.jpg"},
    {"name": "Avery Lane",       "email": "avery.demo@hiagain.xyz",       "city": "Nashville", "bio": "Singer-songwriter. Broadway every Tuesday.",
     "photo": "https://randomuser.me/api/portraits/women/36.jpg"},
    {"name": "Diego Morales",    "email": "diego.demo@hiagain.xyz",       "city": "Miami",     "bio": "Wynwood murals, Cuban coffee, late nights.",
     "photo": "https://randomuser.me/api/portraits/men/81.jpg"},
    {"name": "Hana Park",        "email": "hana.demo@hiagain.xyz",        "city": "Portland",  "bio": "Coffee + trails + books. Not a hipster (ok, maybe).",
     "photo": "https://randomuser.me/api/portraits/women/29.jpg"},
    {"name": "Marcus Reid",      "email": "marcus.demo@hiagain.xyz",      "city": "Boston",    "bio": "Red Sox forever. Running the Charles daily.",
     "photo": "https://randomuser.me/api/portraits/men/11.jpg"},
    # India — most populated cities (signups coming in from here)
    {"name": "Arjun Mehta",      "email": "arjun.demo@hiagain.xyz",       "city": "Mumbai",    "bio": "Bandra cafes, Marine Drive sunsets. Cricket > everything 🏏",
     "photo": "https://randomuser.me/api/portraits/men/45.jpg"},
    {"name": "Aanya Sharma",     "email": "aanya.demo@hiagain.xyz",       "city": "Mumbai",    "bio": "Filmmaker. Always at PVR Juhu. DMs open for chai.",
     "photo": "https://randomuser.me/api/portraits/women/79.jpg"},
    {"name": "Rohan Kapoor",     "email": "rohan.demo@hiagain.xyz",       "city": "Delhi",     "bio": "Hauz Khas regular. Startup founder. Loves momos.",
     "photo": "https://randomuser.me/api/portraits/men/53.jpg"},
    {"name": "Ishita Reddy",     "email": "ishita.demo@hiagain.xyz",      "city": "Bangalore", "bio": "Indiranagar craft beer + Cubbon Park reader.",
     "photo": "https://randomuser.me/api/portraits/women/22.jpg"},
    {"name": "Vikram Iyer",      "email": "vikram.demo@hiagain.xyz",      "city": "Bangalore", "bio": "Koramangala dev. Bike rides every weekend.",
     "photo": "https://randomuser.me/api/portraits/men/29.jpg"},
    {"name": "Sanya Khanna",     "email": "sanya.demo@hiagain.xyz",       "city": "Hyderabad", "bio": "Banjara Hills artist. Biryani fanatic. INOX regular.",
     "photo": "https://randomuser.me/api/portraits/women/56.jpg"},
]

# Events/places tied to each city so crossings feel plausible
CITY_EVENTS = {
    "San Diego":     ["Petco Park", "Balboa Park", "Comic-Con 2026", "La Jolla Cove", "Pacific Beach Pier"],
    "Miami":         ["Taylor Swift Eras Tour", "Wynwood Walls", "Ultra Music Festival", "South Beach", "LIV Nightclub"],
    "New York":      ["Madison Square Garden", "Central Park", "Brooklyn Bridge", "Smorgasburg", "The Met"],
    "Austin":        ["SXSW 2026", "Rainey Street", "Zilker Park", "Franklin BBQ line", "ACL Live"],
    "Los Angeles":   ["The Greek Theatre", "Echo Park Lake", "Grand Central Market", "Griffith Observatory", "Venice Boardwalk"],
    "Seattle":       ["Pike Place Market", "T-Mobile Park", "Kerry Park", "Capitol Hill Block Party", "Chihuly Garden"],
    "San Francisco": ["Dolores Park", "Outside Lands", "Ferry Building", "Golden Gate Park", "Chase Center"],
    "Chicago":       ["Lollapalooza 2026", "Wrigley Field", "Lincoln Park Zoo", "Millennium Park", "The Bean"],
    "Nashville":     ["Bridgestone Arena", "Broadway Honky Tonks", "Ryman Auditorium", "Centennial Park", "CMA Fest"],
    "Portland":      ["Powell's Books", "Voodoo Doughnut", "Forest Park", "Mississippi Studios", "Saturday Market"],
    "Boston":        ["Fenway Park", "Boston Common", "Harvard Square", "The Charles", "TD Garden"],
    "Mumbai":        ["Marine Drive", "Bandra Bandstand", "Phoenix Marketcity", "Juhu Beach", "BKC"],
    "Delhi":         ["Hauz Khas Village", "India Gate", "Connaught Place", "Lodhi Garden", "Khan Market"],
    "Bangalore":     ["Cubbon Park", "Indiranagar 100ft Road", "MG Road", "Koramangala 5th Block", "UB City"],
    "Hyderabad":     ["Banjara Hills", "Hussain Sagar", "Charminar", "Jubilee Hills", "Hitec City"],
}

# Post content — mix of missed-connection style + general vibes
POST_TEMPLATES = [
    ("[Missed Connection] {event} — you wore that green jacket. I chickened out. 💚", "{event}"),
    ("Peak sunset at {event} tonight. This city doesn't miss.", "{event}"),
    ("Saw someone reading Sally Rooney at {event}. If that was you — hi. 📚", "{event}"),
    ("Third time running into the same stranger this week at {event}. Universe giving hints?", "{event}"),
    ("[Missed Connection] Coffee line at {event}, you laughed at my bad joke. Should've asked your name.", "{event}"),
    ("{event} was unreal tonight. Anyone else there?", "{event}"),
    ("You were at {event} in the Padres cap. I was the one who dropped my phone. Thanks 🙏", "{event}"),
    ("Crossed paths w/ a stranger at {event} who recommended the exact book I needed. Universe is wild.", "{event}"),
    ("[Missed Connection] {event}, 7pm. You had a Polaroid. I had a beer. We made eye contact. Hi.", "{event}"),
    ("First time at {event} — not my last. ✨", "{event}"),
]

POST_IMAGE_SEEDS = [
    "https://picsum.photos/seed/hiagain1/800/600",
    "https://picsum.photos/seed/hiagain2/800/600",
    "https://picsum.photos/seed/hiagain3/800/600",
    "https://picsum.photos/seed/hiagain4/800/600",
    "https://picsum.photos/seed/hiagain5/800/600",
    "https://picsum.photos/seed/hiagain6/800/600",
    "https://picsum.photos/seed/hiagain7/800/600",
    "https://picsum.photos/seed/hiagain8/800/600",
    "https://picsum.photos/seed/hiagain9/800/600",
    "https://picsum.photos/seed/hiagain10/800/600",
]

# Gatherings to show on /gatherings page
GATHERINGS = [
    {
        "title": "Sunset Padres Game Meetup", "city": "San Diego", "location": "Petco Park — Gate K",
        "category": "sports", "description": "Meeting up before Friday's game. Ticket share + dinner after. All welcome.",
        "days_out": 8,
    },
    {
        "title": "Wynwood Walls Art Walk", "city": "Miami", "location": "NW 2nd Ave & NW 25th St",
        "category": "art", "description": "Monthly walking tour of the murals. New artists this month. BYO camera.",
        "days_out": 12,
    },
    {
        "title": "Central Park Morning Run", "city": "New York", "location": "Bethesda Fountain, 7am",
        "category": "fitness", "description": "Chill 5k loop around the reservoir. All paces welcome. Coffee after.",
        "days_out": 3,
    },
    {
        "title": "SXSW Afterparty Hang", "city": "Austin", "location": "Rainey Street — The Container Bar",
        "category": "social", "description": "Decompress after the panels. No agenda, just vibes.",
        "days_out": 20,
    },
]


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def ref_code(name: str, idx: int) -> str:
    base = "".join(c for c in name.upper() if c.isalpha())[:4] or "USER"
    return f"{base}{1000 + idx}"


async def wipe(db):
    r1 = await db.users.delete_many({"is_demo": True})
    r2 = await db.posts.delete_many({"is_demo": True})
    r3 = await db.locations.delete_many({"is_demo": True})
    r4 = await db.crossings.delete_many({"is_demo": True})
    r5 = await db.gatherings.delete_many({"is_demo": True})
    print(f"Wiped demo rows → users:{r1.deleted_count}, posts:{r2.deleted_count}, "
          f"locations:{r3.deleted_count}, crossings:{r4.deleted_count}, gatherings:{r5.deleted_count}")


async def seed(db):
    # --- Look up admin so we can build crossings against them ----------
    admin = await db.users.find_one({"email": ADMIN_EMAIL}, {"_id": 0})
    if not admin:
        print(f"ERROR: Admin {ADMIN_EMAIL} not found. Create admin first.")
        return
    admin_id = admin["id"]
    admin_name = admin.get("name", "Admin")
    admin_photo = admin.get("photo_url")

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    pw_hash = hash_pw(DEMO_PASSWORD)

    created_user_ids = []
    for idx, u in enumerate(DEMO_USERS):
        existing = await db.users.find_one({"email": u["email"]}, {"_id": 0, "id": 1})
        if existing:
            created_user_ids.append(existing["id"])
            continue
        uid = str(uuid.uuid4())
        doc = {
            "id": uid,
            "email": u["email"],
            "name": u["name"],
            "password_hash": pw_hash,
            "photo_url": u["photo"],
            "avatar_url": u["photo"],
            "bio": u["bio"],
            "city": u["city"],
            "created_at": (now - timedelta(days=random.randint(2, 60))).isoformat(),
            "email_verified": True,
            "onboarded": True,
            "ghost_mode": False,
            "is_premium": idx % 4 == 0,          # ~25% premium for variety
            "is_demo": DEMO_TAG,
            "referral_code": ref_code(u["name"], idx),
        }
        await db.users.insert_one(doc)
        created_user_ids.append(uid)

    # --- Locations per user (mix of their city + a shared city w/ admin) ---
    admin_cities = []  # list of (proper_case_city, event, date)
    seen = set()
    async for loc in db.locations.find({"user_id": admin_id}, {"_id": 0, "city": 1, "event_or_place": 1, "date": 1}):
        c = loc.get("city")
        if c and c.lower() not in ("unknown", ""):
            key = (c, loc.get("event_or_place", ""), loc.get("date", ""))
            if key not in seen:
                seen.add(key)
                admin_cities.append(key)

    for idx, (uid, u) in enumerate(zip(created_user_ids, DEMO_USERS)):
        # Skip if they already have seeded locations
        count = await db.locations.count_documents({"user_id": uid, "is_demo": DEMO_TAG})
        if count:
            continue
        events = CITY_EVENTS.get(u["city"], [u["city"]])
        for ev in random.sample(events, min(3, len(events))):
            loc_date = (now - timedelta(days=random.randint(1, 45))).strftime("%Y-%m-%d")
            await db.locations.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": uid,
                "city": u["city"],
                "event_or_place": ev,
                "date": loc_date,
                "description": None,
                "created_at": now_iso,
                "is_demo": DEMO_TAG,
            })

    # --- Crossings with the admin (so dashboard looks alive) ---
    # Build a handful of crossings where admin "crossed paths" with these users.
    # Reuse existing admin cities first, then sprinkle a few new plausible ones.
    existing_xings = set()
    async for x in db.crossings.find({"user_id": admin_id}, {"_id": 0, "other_user_id": 1, "city": 1, "event_or_place": 1}):
        existing_xings.add((x.get("other_user_id"), x.get("city"), x.get("event_or_place")))

    admin_known_cities = list({c for c, _, _ in admin_cities}) or ["San Diego", "Miami"]
    crossing_targets = random.sample(list(zip(created_user_ids, DEMO_USERS)), min(8, len(created_user_ids)))
    match_types = ["moment", "path", "nearby", "alumni"]
    scores = ["high", "medium", "low"]

    for uid, u in crossing_targets:
        city = random.choice(admin_known_cities)
        events = CITY_EVENTS.get(city, ["Hangout"])
        ev = random.choice(events)
        key = (uid, city, ev)
        if key in existing_xings:
            continue
        x_date = (now - timedelta(days=random.randint(1, 30))).strftime("%Y-%m-%d")
        match_type = random.choice(match_types)
        score = random.choice(scores)
        overlap = random.randint(1, 4)

        # Admin side
        await db.crossings.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": admin_id,
            "other_user_id": uid,
            "other_user_name": u["name"],
            "other_user_email": u["email"],
            "other_user_photo": u["photo"],
            "city": city,
            "event_or_place": ev,
            "date": x_date,
            "match_score": score,
            "match_type": match_type,
            "overlap_count": overlap,
            "created_at": now_iso,
            "is_demo": DEMO_TAG,
        })
        # Reciprocal (so the demo user's dashboard also shows admin)
        await db.crossings.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": uid,
            "other_user_id": admin_id,
            "other_user_name": admin_name,
            "other_user_email": ADMIN_EMAIL,
            "other_user_photo": admin_photo,
            "city": city,
            "event_or_place": ev,
            "date": x_date,
            "match_score": score,
            "match_type": match_type,
            "overlap_count": overlap,
            "created_at": now_iso,
            "is_demo": DEMO_TAG,
        })

    # --- Posts (feed content) ---
    post_count = await db.posts.count_documents({"is_demo": DEMO_TAG})
    target_posts = 18
    needed = max(0, target_posts - post_count)
    for i in range(needed):
        u_idx = i % len(DEMO_USERS)
        u = DEMO_USERS[u_idx]
        uid = created_user_ids[u_idx]
        ev = random.choice(CITY_EVENTS.get(u["city"], [u["city"]]))
        caption_tpl, loc_tpl = random.choice(POST_TEMPLATES)
        post_date = (now - timedelta(days=random.randint(0, 20), hours=random.randint(0, 23))).isoformat()
        await db.posts.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": uid,
            "user_name": u["name"],
            "user_photo": u["photo"],
            "is_premium": u_idx % 4 == 0,
            "media_url": random.choice(POST_IMAGE_SEEDS),
            "media_type": "image",
            "caption": caption_tpl.format(event=ev),
            "location": loc_tpl.format(event=ev),
            "likes": random.sample(created_user_ids, k=random.randint(1, min(5, len(created_user_ids)))),
            "likes_count": random.randint(2, 47),
            "comments_count": random.randint(0, 12),
            "created_at": post_date,
            "is_demo": DEMO_TAG,
        })

    # --- Gatherings ---
    gather_count = await db.gatherings.count_documents({"is_demo": DEMO_TAG})
    if gather_count == 0:
        for g in GATHERINGS:
            host_idx = random.randrange(len(DEMO_USERS))
            host = DEMO_USERS[host_idx]
            host_id = created_user_ids[host_idx]
            g_date = (now + timedelta(days=g["days_out"])).strftime("%Y-%m-%d")
            g_time = random.choice(["18:00", "19:30", "20:00", "07:00", "11:00"])
            attendee_pool = random.sample(created_user_ids, k=min(random.randint(3, 8), len(created_user_ids)))
            if host_id not in attendee_pool:
                attendee_pool.append(host_id)
            await db.gatherings.insert_one({
                "id": str(uuid.uuid4()),
                "host_id": host_id,
                "host_name": host["name"],
                "host_photo": host["photo"],
                "title": g["title"],
                "description": g["description"],
                "category": g["category"],
                "location": g["location"],
                "city": g["city"],
                "date": g_date,
                "time": g_time,
                "max_attendees": 20,
                "is_private": False,
                "cover_image": random.choice(POST_IMAGE_SEEDS),
                "attendees": attendee_pool,
                "created_at": now_iso,
                "is_demo": DEMO_TAG,
            })

    # --- Summary ---
    totals = {
        "users":      await db.users.count_documents({"is_demo": DEMO_TAG}),
        "locations":  await db.locations.count_documents({"is_demo": DEMO_TAG}),
        "crossings":  await db.crossings.count_documents({"is_demo": DEMO_TAG}),
        "posts":      await db.posts.count_documents({"is_demo": DEMO_TAG}),
        "gatherings": await db.gatherings.count_documents({"is_demo": DEMO_TAG}),
    }
    print("Seed complete →", totals)
    print(f"Demo login password (all demo users): {DEMO_PASSWORD}")


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    try:
        if "--wipe" in sys.argv:
            await wipe(db)
        else:
            await seed(db)
    finally:
        client.close()


if __name__ == "__main__":
    random.seed(42)  # deterministic selections
    asyncio.run(main())
