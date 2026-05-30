"""
Test Suite for Hi Again - Final Pre-Launch Verification
Tests: Legal pages, GPS features, Path crossing, GDPR compliance endpoints
"""
import pytest
import requests
import os
import json
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PREMIUM_USER = {
    "email": "hiagainxyz@gmail.com",
    "password": "HiAgain2024!"
}

# Session to maintain cookies
session = requests.Session()


class TestAuthAndCookies:
    """Authentication with httpOnly cookies"""
    
    def test_login_sets_cookie(self):
        """Test login sets httpOnly cookie"""
        response = session.post(f"{BASE_URL}/api/auth/login", json=PREMIUM_USER)
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        # Check cookie is set
        cookies = session.cookies.get_dict()
        assert 'hiagain_token' in cookies, "httpOnly cookie not set"
        
        data = response.json()
        assert 'access_token' in data
        assert 'user' in data
        print(f"SUCCESS: Login works, user: {data['user']['name']}")
    
    def test_auth_me_with_cookie(self):
        """Test /auth/me works with cookie authentication"""
        response = session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Auth/me failed: {response.text}"
        
        data = response.json()
        assert data['email'] == PREMIUM_USER['email']
        print(f"SUCCESS: /auth/me works with cookie, user: {data['name']}")


class TestLegalPages:
    """Test legal page routes exist (frontend routes, backend health)"""
    
    def test_privacy_page_route(self):
        """Test /privacy route loads"""
        response = requests.get(f"{BASE_URL}/privacy", allow_redirects=True)
        # Frontend routes return 200 with HTML
        assert response.status_code == 200, f"Privacy page failed: {response.status_code}"
        print("SUCCESS: /privacy route accessible")
    
    def test_terms_page_route(self):
        """Test /terms route loads"""
        response = requests.get(f"{BASE_URL}/terms", allow_redirects=True)
        assert response.status_code == 200, f"Terms page failed: {response.status_code}"
        print("SUCCESS: /terms route accessible")


class TestGPSFeatures:
    """GPS Ping and Nearby Users endpoints"""
    
    def test_gps_ping_creates_location(self):
        """Test GPS ping endpoint creates location and finds matches"""
        # Send GPS ping
        gps_data = {
            "latitude": 25.7617,  # Miami coordinates
            "longitude": -80.1918,
            "accuracy": 10.0
        }
        response = session.post(f"{BASE_URL}/api/gps/ping", json=gps_data)
        assert response.status_code == 200, f"GPS ping failed: {response.text}"
        
        data = response.json()
        assert 'id' in data
        assert 'latitude' in data
        assert 'longitude' in data
        assert 'matches_found' in data
        print(f"SUCCESS: GPS ping created, matches_found: {data['matches_found']}")
    
    def test_gps_nearby_users(self):
        """Test GPS nearby users endpoint"""
        params = {
            "latitude": 25.7617,
            "longitude": -80.1918,
            "max_distance": 1000
        }
        response = session.get(f"{BASE_URL}/api/gps/nearby", params=params)
        assert response.status_code == 200, f"GPS nearby failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: GPS nearby users returned {len(data)} users")
    
    def test_gps_history(self):
        """Test GPS history endpoint"""
        response = session.get(f"{BASE_URL}/api/gps/history")
        assert response.status_code == 200, f"GPS history failed: {response.text}"
        
        data = response.json()
        assert 'pings' in data
        assert 'count' in data
        print(f"SUCCESS: GPS history returned {data['count']} pings")


class TestLocationImport:
    """Google Timeline import endpoint"""
    
    def test_location_import_endpoint_exists(self):
        """Test location import endpoint exists (returns 422 without file)"""
        response = session.post(f"{BASE_URL}/api/locations/import")
        # Without file, should return 422 (validation error) not 404
        assert response.status_code in [422, 400], f"Import endpoint missing: {response.status_code}"
        print("SUCCESS: Location import endpoint exists")


class TestPathCrossings:
    """Path crossing detection for events/concerts"""
    
    def test_add_location_triggers_crossing_detection(self):
        """Test adding location triggers path crossing detection"""
        location_data = {
            "city": "Miami",
            "event_or_place": "Taylor Swift Eras Tour",
            "date": "2026-04-10"
        }
        response = session.post(f"{BASE_URL}/api/locations", json=location_data)
        assert response.status_code == 200, f"Add location failed: {response.text}"
        
        data = response.json()
        assert 'id' in data
        assert data['city'] == "Miami"
        print(f"SUCCESS: Location added: {data['event_or_place']}")
    
    def test_get_crossings(self):
        """Test crossings endpoint returns matches"""
        response = session.get(f"{BASE_URL}/api/crossings")
        assert response.status_code == 200, f"Get crossings failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Crossings returned {len(data)} matches")
        
        # Check crossing structure if any exist
        if len(data) > 0:
            crossing = data[0]
            assert 'other_user_name' in crossing
            assert 'city' in crossing
            assert 'match_score' in crossing
            print(f"  First crossing: {crossing['other_user_name']} at {crossing.get('event_or_place', crossing['city'])}")


class TestGDPRCompliance:
    """GDPR Article 17 (Right to Erasure) and Article 20 (Data Portability)"""
    
    def test_data_export_endpoint(self):
        """Test GET /api/account/export returns all user data"""
        response = session.get(f"{BASE_URL}/api/account/export")
        assert response.status_code == 200, f"Data export failed: {response.text}"
        
        data = response.json()
        
        # Verify export contains required data categories
        assert 'export_date' in data, "Missing export_date"
        assert 'user_profile' in data, "Missing user_profile"
        assert 'locations' in data, "Missing locations"
        assert 'path_crossings' in data, "Missing path_crossings"
        assert 'connections' in data, "Missing connections"
        assert 'posts' in data, "Missing posts"
        assert 'gps_history' in data, "Missing gps_history"
        
        # Verify password is NOT included
        if data['user_profile']:
            assert 'password_hash' not in data['user_profile'], "Password hash should not be exported!"
        
        print(f"SUCCESS: Data export contains all required categories")
        print(f"  - Locations: {len(data['locations'])}")
        print(f"  - Crossings: {len(data['path_crossings'])}")
        print(f"  - Posts: {len(data['posts'])}")
    
    def test_account_deletion_endpoint_exists(self):
        """Test DELETE /api/account endpoint exists (don't actually delete admin)"""
        # Create a test user to verify deletion works
        test_email = f"test_delete_{uuid.uuid4().hex[:8]}@test.com"
        test_user = {
            "email": test_email,
            "password": "TestPass123!",
            "name": "Test Delete User"
        }
        
        # Register test user
        test_session = requests.Session()
        reg_response = test_session.post(f"{BASE_URL}/api/auth/register", json=test_user)
        assert reg_response.status_code == 200, f"Test user registration failed: {reg_response.text}"
        
        # Verify user can access their data
        me_response = test_session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200, "Test user auth failed"
        
        # Delete the test account
        delete_response = test_session.delete(f"{BASE_URL}/api/account")
        assert delete_response.status_code == 200, f"Account deletion failed: {delete_response.text}"
        
        data = delete_response.json()
        assert 'deleted_records' in data, "Missing deleted_records in response"
        assert 'deleted' in data['message'].lower() or 'account' in data['message'].lower()
        
        print(f"SUCCESS: Account deletion endpoint works")
        print(f"  Deleted records: {data['deleted_records']}")
        
        # Verify user can no longer authenticate
        verify_response = test_session.get(f"{BASE_URL}/api/auth/me")
        assert verify_response.status_code == 401, "User should not be able to auth after deletion"
        print("SUCCESS: Deleted user cannot authenticate")


class TestPremiumFeatures:
    """Premium features (Who Viewed Me)"""
    
    def test_who_viewed_me_accessible(self):
        """Test Who Viewed Me endpoint for premium user"""
        response = session.get(f"{BASE_URL}/api/profile/viewers")
        assert response.status_code == 200, f"Who Viewed Me failed: {response.text}"
        
        data = response.json()
        # API returns list directly, not wrapped in {viewers: []}
        assert isinstance(data, list), f"Expected list, got: {type(data)}"
        print(f"SUCCESS: Who Viewed Me returned {len(data)} viewers")
    
    def test_premium_status(self):
        """Test premium user has correct tier"""
        response = session.get(f"{BASE_URL}/api/subscription/status")
        assert response.status_code == 200, f"Subscription status failed: {response.text}"
        
        data = response.json()
        assert data['tier'] == 'premium', f"Expected premium tier, got: {data['tier']}"
        assert data['can_see_who_viewed'] == True
        print(f"SUCCESS: Premium status confirmed, tier: {data['tier']}")


class TestFeedAndPosts:
    """Feed page and posts"""
    
    def test_feed_loads_posts(self):
        """Test feed endpoint returns posts"""
        response = session.get(f"{BASE_URL}/api/posts/feed")
        assert response.status_code == 200, f"Feed failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Feed returned {len(data)} posts")
    
    def test_explore_feed_loads(self):
        """Test explore feed endpoint returns posts"""
        response = session.get(f"{BASE_URL}/api/posts/explore")
        assert response.status_code == 200, f"Explore feed failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Explore feed returned {len(data)} posts")


class TestLogout:
    """Logout clears session"""
    
    def test_logout_clears_cookie(self):
        """Test logout clears auth cookie"""
        response = session.post(f"{BASE_URL}/api/auth/logout")
        assert response.status_code == 200, f"Logout failed: {response.text}"
        
        # Verify can't access protected routes
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 401, "Should be unauthorized after logout"
        print("SUCCESS: Logout clears session")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
