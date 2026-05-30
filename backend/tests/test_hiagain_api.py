"""
Hi Again API Tests - Comprehensive testing for all endpoints
Tests: Auth, Crossings, Connections, Feed, Profile, Premium
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials - loaded from environment variables for security
OWNER_EMAIL = os.environ.get('TEST_OWNER_EMAIL', 'hiagainxyz@gmail.com')
OWNER_PASSWORD = os.environ.get('TEST_OWNER_PASSWORD', 'HiAgain2024!')

class TestHealthAndBasics:
    """Health check and basic API tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✅ Health endpoint working")
    
    def test_root_endpoint(self):
        """Test /api/ returns API info"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "Hi Again API" in data.get("message", "")
        print("✅ Root endpoint working")


class TestAuthentication:
    """Authentication flow tests"""
    
    def test_login_with_valid_credentials(self):
        """Test login with owner account"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == OWNER_EMAIL
        assert data["user"]["name"] == "Jay Sal"
        print(f"✅ Login successful for {OWNER_EMAIL}")
    
    def test_login_with_invalid_credentials(self):
        """Test login rejection with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✅ Invalid credentials rejected correctly")
    
    def test_login_with_nonexistent_user(self):
        """Test login rejection for non-existent user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "anypassword"
        })
        assert response.status_code == 401
        print("✅ Non-existent user rejected correctly")
    
    def test_register_new_user(self):
        """Test user registration"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "name": "Test User"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == unique_email
        assert data["user"]["name"] == "Test User"
        print(f"✅ Registration successful for {unique_email}")
    
    def test_register_duplicate_email(self):
        """Test registration rejection for existing email"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": OWNER_EMAIL,
            "password": "anypassword",
            "name": "Duplicate User"
        })
        assert response.status_code == 400
        assert "already registered" in response.json().get("detail", "").lower()
        print("✅ Duplicate email rejected correctly")


class TestAuthenticatedEndpoints:
    """Tests requiring authentication"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.user_id = response.json()["user"]["id"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_current_user(self):
        """Test /api/auth/me returns current user"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == OWNER_EMAIL
        print("✅ Get current user working")
    
    def test_get_crossings(self):
        """Test /api/crossings returns crossings list"""
        response = requests.get(f"{BASE_URL}/api/crossings", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Check crossing structure if data exists
        if len(data) > 0:
            crossing = data[0]
            assert "id" in crossing
            assert "other_user_name" in crossing
            assert "city" in crossing
            assert "event_or_place" in crossing
            # Check new match_score and match_type fields
            assert "match_score" in crossing
            assert "match_type" in crossing
            assert crossing["match_score"] in ["high", "medium", "low"]
            assert crossing["match_type"] in ["moment", "path", "alumni", "nearby"]
            print(f"✅ Crossings endpoint working - {len(data)} crossings found with match scores")
        else:
            print("✅ Crossings endpoint working - no crossings yet")
    
    def test_get_crossing_stats(self):
        """Test /api/crossings/stats returns stats"""
        response = requests.get(f"{BASE_URL}/api/crossings/stats", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_crossings" in data
        assert "unique_people" in data
        assert "total_locations" in data
        print(f"✅ Crossing stats: {data['total_crossings']} crossings, {data['unique_people']} unique people")
    
    def test_get_connections(self):
        """Test /api/connections returns connections list"""
        response = requests.get(f"{BASE_URL}/api/connections", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Connections endpoint working - {len(data)} connections")
    
    def test_get_locations(self):
        """Test /api/locations returns locations list"""
        response = requests.get(f"{BASE_URL}/api/locations", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Locations endpoint working - {len(data)} locations")
    
    def test_get_feed(self):
        """Test /api/posts/feed returns feed posts"""
        response = requests.get(f"{BASE_URL}/api/posts/feed", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            post = data[0]
            assert "id" in post
            assert "user_name" in post
            assert "media_url" in post
            assert "likes_count" in post
        print(f"✅ Feed endpoint working - {len(data)} posts")
    
    def test_get_explore_feed(self):
        """Test /api/posts/explore returns explore posts"""
        response = requests.get(f"{BASE_URL}/api/posts/explore", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Explore feed working - {len(data)} posts")
    
    def test_subscription_plans(self):
        """Test /api/subscription/plans returns plans"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        assert response.status_code == 200
        data = response.json()
        assert "plans" in data
        assert len(data["plans"]) >= 2
        # Check plan structure
        monthly = next((p for p in data["plans"] if p["id"] == "monthly"), None)
        yearly = next((p for p in data["plans"] if p["id"] == "yearly"), None)
        assert monthly is not None
        assert yearly is not None
        assert monthly["price"] == 4.99
        print("✅ Subscription plans endpoint working")
    
    def test_subscription_status(self):
        """Test /api/subscription/status returns user status"""
        response = requests.get(f"{BASE_URL}/api/subscription/status", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "tier" in data
        assert "usage" in data
        print(f"✅ Subscription status: tier={data['tier']}")
    
    def test_donation_packages(self):
        """Test /api/donations/packages returns packages"""
        response = requests.get(f"{BASE_URL}/api/donations/packages")
        assert response.status_code == 200
        data = response.json()
        assert "packages" in data
        assert len(data["packages"]) >= 4
        print("✅ Donation packages endpoint working")


class TestLocationCRUD:
    """Location CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_add_location(self):
        """Test adding a new location"""
        response = requests.post(f"{BASE_URL}/api/locations", 
            headers=self.headers,
            json={
                "city": "Test City",
                "event_or_place": "Test Event",
                "date": "2026-01-15"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["city"] == "Test City"
        assert data["event_or_place"] == "Test Event"
        assert "id" in data
        print(f"✅ Location added: {data['id']}")
        
        # Cleanup - delete the location
        delete_response = requests.delete(
            f"{BASE_URL}/api/locations/{data['id']}", 
            headers=self.headers
        )
        assert delete_response.status_code == 200
        print("✅ Location deleted successfully")


class TestProfileUpdate:
    """Profile update tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_update_profile_bio(self):
        """Test updating profile bio"""
        response = requests.patch(f"{BASE_URL}/api/profile",
            headers=self.headers,
            json={"bio": "Test bio update"}
        )
        assert response.status_code == 200
        print("✅ Profile bio update working")


class TestPostInteractions:
    """Post like and comment tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and find a post"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": OWNER_EMAIL,
            "password": OWNER_PASSWORD
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get a post to interact with
        feed_response = requests.get(f"{BASE_URL}/api/posts/explore", headers=self.headers)
        posts = feed_response.json()
        self.test_post_id = posts[0]["id"] if posts else None
    
    def test_like_post(self):
        """Test liking a post"""
        if not self.test_post_id:
            pytest.skip("No posts available to test")
        
        response = requests.post(
            f"{BASE_URL}/api/posts/{self.test_post_id}/like",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "action" in data
        assert data["action"] in ["liked", "unliked"]
        print(f"✅ Post {data['action']} successfully")
    
    def test_add_comment(self):
        """Test adding a comment to a post"""
        if not self.test_post_id:
            pytest.skip("No posts available to test")
        
        response = requests.post(
            f"{BASE_URL}/api/posts/{self.test_post_id}/comments",
            headers=self.headers,
            json={"text": "Test comment from API test"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["text"] == "Test comment from API test"
        print("✅ Comment added successfully")
    
    def test_get_comments(self):
        """Test getting comments for a post"""
        if not self.test_post_id:
            pytest.skip("No posts available to test")
        
        response = requests.get(
            f"{BASE_URL}/api/posts/{self.test_post_id}/comments",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Got {len(data)} comments")


class TestUnauthorizedAccess:
    """Test endpoints require authentication"""
    
    def test_crossings_requires_auth(self):
        """Test /api/crossings requires auth"""
        response = requests.get(f"{BASE_URL}/api/crossings")
        assert response.status_code in [401, 403]
        print("✅ Crossings endpoint requires auth")
    
    def test_feed_requires_auth(self):
        """Test /api/posts/feed requires auth"""
        response = requests.get(f"{BASE_URL}/api/posts/feed")
        assert response.status_code in [401, 403]
        print("✅ Feed endpoint requires auth")
    
    def test_connections_requires_auth(self):
        """Test /api/connections requires auth"""
        response = requests.get(f"{BASE_URL}/api/connections")
        assert response.status_code in [401, 403]
        print("✅ Connections endpoint requires auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
