"""
Premium VIP Features Tests - Testing premium subscription and gating
Tests: Subscription status, Profile viewers, Who Viewed Me, VIP badges
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials - loaded from environment variables for security
PREMIUM_USER_EMAIL = os.environ.get('TEST_PREMIUM_USER_EMAIL', 'hiagainxyz@gmail.com')
PREMIUM_USER_PASSWORD = os.environ.get('TEST_PREMIUM_USER_PASSWORD', 'HiAgain2024!')

FREE_USER_EMAIL = os.environ.get('TEST_FREE_USER_EMAIL', 'test_free@test.com')
FREE_USER_PASSWORD = os.environ.get('TEST_FREE_USER_PASSWORD', 'testpass123')


class TestSubscriptionStatus:
    """Test subscription status endpoint returns correct tier"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for premium user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PREMIUM_USER_EMAIL,
            "password": PREMIUM_USER_PASSWORD
        })
        assert response.status_code == 200, f"Premium user login failed: {response.text}"
        self.premium_token = response.json()["access_token"]
        self.premium_user_id = response.json()["user"]["id"]
        self.premium_headers = {"Authorization": f"Bearer {self.premium_token}"}
    
    def test_premium_user_subscription_status(self):
        """Test /api/subscription/status returns tier:premium for premium user"""
        response = requests.get(f"{BASE_URL}/api/subscription/status", headers=self.premium_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify tier is premium
        assert "tier" in data, "Response missing 'tier' field"
        assert data["tier"] == "premium", f"Expected tier 'premium', got '{data['tier']}'"
        
        # Verify premium features are enabled
        assert data.get("can_see_who_viewed") == True, "Premium user should have can_see_who_viewed=True"
        assert data.get("can_see_full_profile") == True, "Premium user should have can_see_full_profile=True"
        assert data.get("verified_badge") == True, "Premium user should have verified_badge=True"
        
        print(f"✅ Premium user subscription status: tier={data['tier']}")
        print(f"   Features: can_see_who_viewed={data.get('can_see_who_viewed')}, verified_badge={data.get('verified_badge')}")


class TestFreeUserSubscriptionStatus:
    """Test subscription status for free users"""
    
    def test_create_free_user_and_check_status(self):
        """Create a new free user and verify they have free tier"""
        # Create a new user (will be free by default)
        unique_email = f"test_free_{uuid.uuid4().hex[:8]}@test.com"
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "name": "Test Free User"
        })
        assert register_response.status_code == 200, f"Registration failed: {register_response.text}"
        
        token = register_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Check subscription status
        status_response = requests.get(f"{BASE_URL}/api/subscription/status", headers=headers)
        assert status_response.status_code == 200
        data = status_response.json()
        
        # Verify tier is free
        assert data["tier"] == "free", f"New user should have tier 'free', got '{data['tier']}'"
        assert data.get("can_see_who_viewed") == False, "Free user should have can_see_who_viewed=False"
        assert data.get("verified_badge") == False, "Free user should have verified_badge=False"
        
        print(f"✅ Free user subscription status: tier={data['tier']}")
        print(f"   Limits: max_locations={data.get('max_locations')}, max_messages_per_day={data.get('max_messages_per_day')}")


class TestProfileViewTracking:
    """Test profile view recording endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup two users - one to view, one to be viewed"""
        # Login as premium user (will be viewed)
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PREMIUM_USER_EMAIL,
            "password": PREMIUM_USER_PASSWORD
        })
        assert response.status_code == 200
        self.premium_token = response.json()["access_token"]
        self.premium_user_id = response.json()["user"]["id"]
        self.premium_headers = {"Authorization": f"Bearer {self.premium_token}"}
        
        # Create a viewer user
        self.viewer_email = f"viewer_{uuid.uuid4().hex[:8]}@test.com"
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.viewer_email,
            "password": "testpass123",
            "name": "Profile Viewer"
        })
        assert register_response.status_code == 200
        self.viewer_token = register_response.json()["access_token"]
        self.viewer_user_id = register_response.json()["user"]["id"]
        self.viewer_headers = {"Authorization": f"Bearer {self.viewer_token}"}
    
    def test_record_profile_view(self):
        """Test POST /api/profile/{user_id}/view records a view"""
        # Viewer views premium user's profile
        response = requests.post(
            f"{BASE_URL}/api/profile/{self.premium_user_id}/view",
            headers=self.viewer_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✅ Profile view recorded: {data['message']}")
    
    def test_self_view_not_recorded(self):
        """Test viewing own profile doesn't record a view"""
        response = requests.post(
            f"{BASE_URL}/api/profile/{self.premium_user_id}/view",
            headers=self.premium_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "Self view not recorded" in data.get("message", "")
        print("✅ Self view correctly not recorded")


class TestProfileViewersEndpoint:
    """Test profile viewers endpoint with premium gating"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup premium and free users"""
        # Login as premium user
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PREMIUM_USER_EMAIL,
            "password": PREMIUM_USER_PASSWORD
        })
        assert response.status_code == 200
        self.premium_token = response.json()["access_token"]
        self.premium_user_id = response.json()["user"]["id"]
        self.premium_headers = {"Authorization": f"Bearer {self.premium_token}"}
        
        # Create a free user
        self.free_email = f"free_{uuid.uuid4().hex[:8]}@test.com"
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.free_email,
            "password": "testpass123",
            "name": "Free User"
        })
        assert register_response.status_code == 200
        self.free_token = register_response.json()["access_token"]
        self.free_headers = {"Authorization": f"Bearer {self.free_token}"}
    
    def test_premium_user_can_see_viewers(self):
        """Test GET /api/profile/viewers works for premium users"""
        response = requests.get(f"{BASE_URL}/api/profile/viewers", headers=self.premium_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Response should be a list of viewers"
        print(f"✅ Premium user can see profile viewers: {len(data)} viewers")
    
    def test_free_user_cannot_see_viewers(self):
        """Test GET /api/profile/viewers returns 403 for free users"""
        response = requests.get(f"{BASE_URL}/api/profile/viewers", headers=self.free_headers)
        assert response.status_code == 403, f"Expected 403 for free user, got {response.status_code}"
        data = response.json()
        assert "Premium" in data.get("detail", ""), "Error should mention Premium"
        print(f"✅ Free user correctly blocked from viewers: {data.get('detail')}")
    
    def test_viewers_count_available_to_all(self):
        """Test GET /api/profile/viewers/count works for all users"""
        # Premium user
        response = requests.get(f"{BASE_URL}/api/profile/viewers/count", headers=self.premium_headers)
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert "is_premium" in data
        assert data["is_premium"] == True
        print(f"✅ Premium user viewers count: {data['count']}, is_premium={data['is_premium']}")
        
        # Free user
        response = requests.get(f"{BASE_URL}/api/profile/viewers/count", headers=self.free_headers)
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert data["is_premium"] == False
        print(f"✅ Free user viewers count: {data['count']}, is_premium={data['is_premium']}")


class TestProfileViewerFlow:
    """Test complete flow: record view -> check viewers"""
    
    def test_complete_profile_view_flow(self):
        """Test recording a view and then retrieving it"""
        # Login as premium user (will be viewed)
        premium_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PREMIUM_USER_EMAIL,
            "password": PREMIUM_USER_PASSWORD
        })
        assert premium_response.status_code == 200
        premium_token = premium_response.json()["access_token"]
        premium_user_id = premium_response.json()["user"]["id"]
        premium_headers = {"Authorization": f"Bearer {premium_token}"}
        
        # Create a viewer
        viewer_email = f"viewer_{uuid.uuid4().hex[:8]}@test.com"
        viewer_name = "Test Viewer Person"
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": viewer_email,
            "password": "testpass123",
            "name": viewer_name
        })
        assert register_response.status_code == 200
        viewer_token = register_response.json()["access_token"]
        viewer_headers = {"Authorization": f"Bearer {viewer_token}"}
        
        # Viewer views premium user's profile
        view_response = requests.post(
            f"{BASE_URL}/api/profile/{premium_user_id}/view",
            headers=viewer_headers
        )
        assert view_response.status_code == 200
        print("✅ View recorded")
        
        # Premium user checks who viewed them
        viewers_response = requests.get(f"{BASE_URL}/api/profile/viewers", headers=premium_headers)
        assert viewers_response.status_code == 200
        viewers = viewers_response.json()
        
        # Find the viewer in the list
        viewer_found = any(v.get("name") == viewer_name for v in viewers)
        assert viewer_found, f"Viewer '{viewer_name}' not found in viewers list"
        print(f"✅ Viewer '{viewer_name}' found in viewers list")


class TestConnectionsWithPremiumInfo:
    """Test connections endpoint includes premium user info"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup premium user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PREMIUM_USER_EMAIL,
            "password": PREMIUM_USER_PASSWORD
        })
        assert response.status_code == 200
        self.premium_token = response.json()["access_token"]
        self.premium_user_id = response.json()["user"]["id"]
        self.premium_headers = {"Authorization": f"Bearer {self.premium_token}"}
    
    def test_connections_endpoint_works(self):
        """Test /api/connections returns connections list"""
        response = requests.get(f"{BASE_URL}/api/connections", headers=self.premium_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Connections endpoint working: {len(data)} connections")


class TestCrossingsWithPremiumInfo:
    """Test crossings endpoint with premium user info"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup premium user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": PREMIUM_USER_EMAIL,
            "password": PREMIUM_USER_PASSWORD
        })
        assert response.status_code == 200
        self.premium_token = response.json()["access_token"]
        self.premium_headers = {"Authorization": f"Bearer {self.premium_token}"}
    
    def test_crossings_endpoint_works(self):
        """Test /api/crossings returns crossings with premium info"""
        response = requests.get(f"{BASE_URL}/api/crossings", headers=self.premium_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Crossings endpoint working: {len(data)} crossings")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
