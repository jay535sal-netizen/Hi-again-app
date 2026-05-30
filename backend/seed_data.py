import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import random

# Sample data
FIRST_NAMES = ["Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia", "Mason", "Isabella", "Lucas", 
               "Mia", "James", "Charlotte", "Benjamin", "Amelia", "Alexander", "Harper", "Daniel", "Evelyn", "Michael"]
LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
              "Anderson", "Taylor", "Thomas", "Moore", "Jackson", "Martin", "Lee", "Thompson", "White", "Harris"]

CITIES = ["Miami", "New York", "Los Angeles", "Austin", "Chicago", "San Francisco", "Denver", "Seattle", "Nashville", "Boston"]
EVENTS = [
    "Taylor Swift Eras Tour", "Coldplay Concert", "Art Basel 2026", "Comic Con", "Food & Wine Festival",
    "Marathon", "Tech Conference", "Jazz Festival", "Beach Volleyball Tournament", "Farmers Market",
    "Coffee Shop - Blue Bottle", "Yoga in the Park", "Book Club Meetup", "Rooftop Bar Night", "Museum Opening",
    "Basketball Game", "Soccer Match", "Comedy Show", "Wine Tasting", "Hiking Trail"
]

CAPTIONS = [
    "Amazing night! Who else was there? 🎉", "Can't believe I ran into so many cool people!",
    "Best event of the year!", "Looking for the person I talked to near the stage 👀",
    "Such a vibe ✨", "If you were there, say hi!", "Unforgettable moment",
    "The energy was unreal!", "Made some amazing connections tonight",
    "Still thinking about this night 💭", "Who else felt the magic?",
    "That sunset though 🌅", "Perfect day, perfect people", "Living my best life"
]

BIOS = [
    "Love meeting new people ✨", "Music lover | Coffee addict", "Always at the best events",
    "Looking for my concert buddy", "Life is about connections", "Adventure seeker 🌎",
    "Believe in serendipity", "Here for the vibes", "Making memories everywhere I go",
    "Your next best friend 💫", "Festival enthusiast", "Night owl 🦉"
]

# Profile photo URLs (placeholder avatars)
AVATAR_COLORS = ["E91E63", "9C27B0", "673AB7", "3F51B5", "2196F3", "00BCD4", "009688", "4CAF50", "FF9800", "FF5722"]

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def generate_avatar_url(name):
    color = random.choice(AVATAR_COLORS)
    return f"https://ui-avatars.com/api/?name={name.replace(' ', '+')}&background={color}&color=fff&size=200&bold=true"

async def seed_database():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'test_database')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🌱 Starting database seeding...")
    
    # Create 15 users
    users = []
    for i in range(15):
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        name = f"{first} {last}"
        email = f"{first.lower()}.{last.lower()}{random.randint(1,99)}@email.com"
        
        user = {
            "id": str(uuid.uuid4()),
            "email": email,
            "name": name,
            "password_hash": hash_password("password123"),
            "photo_url": generate_avatar_url(name),
            "bio": random.choice(BIOS),
            "is_premium": random.random() > 0.7,  # 30% are premium
            "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 60))).isoformat()
        }
        users.append(user)
    
    # Check if users already exist
    existing_count = await db.users.count_documents({})
    if existing_count > 5:
        print(f"⚠️  Database already has {existing_count} users. Skipping user creation.")
    else:
        await db.users.insert_many(users)
        print(f"✅ Created {len(users)} users")
    
    # Fetch all users for creating related data
    all_users = await db.users.find({}, {"_id": 0}).to_list(100)
    
    # Create locations for users
    locations = []
    for user in all_users[:12]:  # Give 12 users locations
        num_locations = random.randint(2, 5)
        for _ in range(num_locations):
            days_ago = random.randint(1, 30)
            loc = {
                "id": str(uuid.uuid4()),
                "user_id": user['id'],
                "city": random.choice(CITIES),
                "event_or_place": random.choice(EVENTS),
                "date": (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime("%Y-%m-%d"),
                "created_at": (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()
            }
            locations.append(loc)
    
    existing_locs = await db.locations.count_documents({})
    if existing_locs < 20:
        await db.locations.insert_many(locations)
        print(f"✅ Created {len(locations)} locations")
    else:
        print(f"⚠️  Already have {existing_locs} locations")
    
    # Create crossings between users
    crossings = []
    used_pairs = set()
    for _ in range(25):
        user1, user2 = random.sample(all_users[:10], 2)
        pair = tuple(sorted([user1['id'], user2['id']]))
        if pair in used_pairs:
            continue
        used_pairs.add(pair)
        
        city = random.choice(CITIES)
        event = random.choice(EVENTS)
        days_ago = random.randint(1, 20)
        
        # Create crossing for user1
        crossings.append({
            "id": str(uuid.uuid4()),
            "user_id": user1['id'],
            "other_user_id": user2['id'],
            "other_user_name": user2['name'],
            "other_user_email": user2['email'],
            "other_user_photo": user2.get('photo_url'),
            "city": city,
            "event_or_place": event,
            "date": (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime("%Y-%m-%d"),
            "created_at": (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()
        })
        # Create reverse crossing for user2
        crossings.append({
            "id": str(uuid.uuid4()),
            "user_id": user2['id'],
            "other_user_id": user1['id'],
            "other_user_name": user1['name'],
            "other_user_email": user1['email'],
            "other_user_photo": user1.get('photo_url'),
            "city": city,
            "event_or_place": event,
            "date": (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime("%Y-%m-%d"),
            "created_at": (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()
        })
    
    existing_crossings = await db.crossings.count_documents({})
    if existing_crossings < 20:
        await db.crossings.insert_many(crossings)
        print(f"✅ Created {len(crossings)} crossings")
    else:
        print(f"⚠️  Already have {existing_crossings} crossings")
    
    # Create posts for the feed
    posts = []
    for user in all_users[:8]:
        num_posts = random.randint(1, 3)
        for _ in range(num_posts):
            days_ago = random.randint(0, 14)
            # Use placeholder images
            img_id = random.randint(1, 100)
            posts.append({
                "id": str(uuid.uuid4()),
                "user_id": user['id'],
                "user_name": user['name'],
                "user_photo": user.get('photo_url'),
                "is_premium": user.get('is_premium', False),
                "media_url": f"https://picsum.photos/seed/{img_id}/600/600",
                "media_type": "image",
                "caption": random.choice(CAPTIONS),
                "location": random.choice(CITIES),
                "likes": [u['id'] for u in random.sample(all_users, random.randint(2, 8))],
                "likes_count": random.randint(5, 50),
                "comments_count": random.randint(0, 10),
                "created_at": (datetime.now(timezone.utc) - timedelta(days=days_ago, hours=random.randint(0, 23))).isoformat()
            })
    
    existing_posts = await db.posts.count_documents({})
    if existing_posts < 10:
        await db.posts.insert_many(posts)
        print(f"✅ Created {len(posts)} posts")
    else:
        print(f"⚠️  Already have {existing_posts} posts")
    
    # Create some comments
    comments = []
    all_posts = await db.posts.find({}, {"_id": 0, "id": 1}).to_list(50)
    comment_texts = [
        "This is amazing! 🔥", "I was there too!", "Love this!", "We should connect!",
        "Best night ever!", "I think I saw you!", "Small world! 🌎", "Let's meet up!",
        "Great photo!", "The vibes were immaculate ✨", "Miss this!", "Take me back!"
    ]
    
    for post in all_posts[:15]:
        num_comments = random.randint(1, 4)
        for _ in range(num_comments):
            commenter = random.choice(all_users)
            comments.append({
                "id": str(uuid.uuid4()),
                "post_id": post['id'],
                "user_id": commenter['id'],
                "user_name": commenter['name'],
                "user_photo": commenter.get('photo_url'),
                "text": random.choice(comment_texts),
                "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 7))).isoformat()
            })
    
    existing_comments = await db.comments.count_documents({})
    if existing_comments < 20:
        await db.comments.insert_many(comments)
        print(f"✅ Created {len(comments)} comments")
    else:
        print(f"⚠️  Already have {existing_comments} comments")
    
    print("\n🎉 Database seeding complete!")
    print(f"   Users: {await db.users.count_documents({})}")
    print(f"   Locations: {await db.locations.count_documents({})}")
    print(f"   Crossings: {await db.crossings.count_documents({})}")
    print(f"   Posts: {await db.posts.count_documents({})}")
    print(f"   Comments: {await db.comments.count_documents({})}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_database())
