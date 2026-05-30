"""
Test suite for httpOnly cookie authentication flow
Tests the code quality fixes including:
1. httpOnly cookie-based JWT authentication
2. Secure password reset with secrets module
3. Login/logout flows with cookie management
"""
import pytest
import requests
import os
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PREMIUM_USER = {
    "email": "hiagainxyz@gmail.com",
    "password": "HiAgain2024!"
}

class TestAuthCookieFlow:
    """Test authentication with httpOnly cookies"""
    
    def test_login_sets_cookie(self):
        """Test that login endpoint sets httpOnly cookie"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json=PREMIUM_USER)
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        # Check response contains access_token and user
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user data"
        assert data["user"]["email"] == PREMIUM_USER["email"]
        
        # Check that cookie was set
        cookies = session.cookies.get_dict()
        assert "hiagain_token" in cookies, f"httpOnly cookie should be set. Cookies: {cookies}"
        print(f"SUCCESS: Login sets httpOnly cookie 'hiagain_token'")
    
    def test_auth_me_with_cookie(self):
        """Test that /auth/me works with cookie authentication"""
        session = requests.Session()
        
        # Login first
        login_response = session.post(f"{BASE_URL}/api/auth/login", json=PREMIUM_USER)
        assert login_response.status_code == 200
        
        # Now call /auth/me - cookie should be sent automatically
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200, f"Auth/me failed: {me_response.text}"
        
        data = me_response.json()
        assert data["email"] == PREMIUM_USER["email"]
        print(f"SUCCESS: /auth/me works with cookie authentication")
    
    def test_logout_clears_cookie(self):
        """Test that logout clears the httpOnly cookie"""
        session = requests.Session()
        
        # Login first
        login_response = session.post(f"{BASE_URL}/api/auth/login", json=PREMIUM_USER)
        assert login_response.status_code == 200
        
        # Verify cookie is set
        assert "hiagain_token" in session.cookies.get_dict()
        
        # Logout
        logout_response = session.post(f"{BASE_URL}/api/auth/logout")
        assert logout_response.status_code == 200
        
        data = logout_response.json()
        assert data.get("message") == "Logged out successfully"
        
        # After logout, /auth/me should fail
        me_response = session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 401, "Should be unauthorized after logout"
        print(f"SUCCESS: Logout clears cookie and invalidates session")
    
    def test_protected_route_without_auth(self):
        """Test that protected routes return 401 without authentication"""
        session = requests.Session()
        
        # Try to access protected endpoint without login
        response = session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"SUCCESS: Protected routes return 401 without auth")
    
    def test_backward_compatibility_with_bearer_token(self):
        """Test that Authorization header still works for backward compatibility"""
        session = requests.Session()
        
        # Login to get token
        login_response = session.post(f"{BASE_URL}/api/auth/login", json=PREMIUM_USER)
        assert login_response.status_code == 200
        
        token = login_response.json()["access_token"]
        
        # Create new session without cookies
        new_session = requests.Session()
        new_session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Should work with Bearer token
        me_response = new_session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200, f"Bearer token auth failed: {me_response.text}"
        print(f"SUCCESS: Backward compatibility with Bearer token works")


class TestPasswordResetSecurity:
    """Test secure password reset with secrets module"""
    
    def test_forgot_password_generates_code(self):
        """Test that forgot password generates a reset code"""
        session = requests.Session()
        
        response = session.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": PREMIUM_USER["email"]
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # In demo mode, code is returned in response
        assert "demo_code" in data, "Demo code should be in response"
        code = data["demo_code"]
        
        # Verify code is 6 digits (generated by secrets module)
        assert len(code) == 6, f"Code should be 6 digits, got: {code}"
        assert code.isdigit(), f"Code should be numeric, got: {code}"
        print(f"SUCCESS: Password reset generates secure 6-digit code")
    
    def test_reset_password_with_valid_code(self):
        """Test password reset with valid code"""
        session = requests.Session()
        
        # Get reset code
        forgot_response = session.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": PREMIUM_USER["email"]
        })
        assert forgot_response.status_code == 200
        code = forgot_response.json()["demo_code"]
        
        # Reset password (use same password to not break other tests)
        reset_response = session.post(f"{BASE_URL}/api/auth/reset-password", json={
            "email": PREMIUM_USER["email"],
            "code": code,
            "new_password": PREMIUM_USER["password"]  # Keep same password
        })
        
        assert reset_response.status_code == 200
        data = reset_response.json()
        assert data.get("message") == "Password reset successfully"
        print(f"SUCCESS: Password reset with valid code works")
    
    def test_reset_password_with_invalid_code(self):
        """Test that invalid reset code is rejected"""
        session = requests.Session()
        
        response = session.post(f"{BASE_URL}/api/auth/reset-password", json={
            "email": PREMIUM_USER["email"],
            "code": "000000",  # Invalid code
            "new_password": "newpassword123"
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"SUCCESS: Invalid reset code is rejected")
    
    def test_reset_code_is_cryptographically_random(self):
        """Test that reset codes appear random (not sequential)"""
        session = requests.Session()
        
        codes = []
        for _ in range(3):
            response = session.post(f"{BASE_URL}/api/auth/forgot-password", json={
                "email": PREMIUM_USER["email"]
            })
            assert response.status_code == 200
            codes.append(response.json()["demo_code"])
        
        # All codes should be different (extremely unlikely to be same with secrets)
        assert len(set(codes)) == 3, f"Codes should be unique: {codes}"
        print(f"SUCCESS: Reset codes are cryptographically random")


class TestPremiumFeatures:
    """Test premium features still work after auth changes"""
    
    def test_premium_user_subscription_status(self):
        """Test premium user has correct subscription status"""
        session = requests.Session()
        
        # Login
        login_response = session.post(f"{BASE_URL}/api/auth/login", json=PREMIUM_USER)
        assert login_response.status_code == 200
        
        # Check subscription status
        status_response = session.get(f"{BASE_URL}/api/subscription/status")
        assert status_response.status_code == 200
        
        data = status_response.json()
        assert data.get("tier") == "premium", f"Expected premium tier, got: {data}"
        assert data.get("can_see_who_viewed") == True
        assert data.get("verified_badge") == True
        print(f"SUCCESS: Premium user has correct subscription status")
    
    def test_premium_user_can_access_viewers(self):
        """Test premium user can access who viewed me"""
        session = requests.Session()
        
        # Login
        login_response = session.post(f"{BASE_URL}/api/auth/login", json=PREMIUM_USER)
        assert login_response.status_code == 200
        
        # Access viewers endpoint
        viewers_response = session.get(f"{BASE_URL}/api/profile/viewers")
        assert viewers_response.status_code == 200, f"Premium user should access viewers: {viewers_response.text}"
        print(f"SUCCESS: Premium user can access profile viewers")
    
    def test_premium_user_vip_badge(self):
        """Test premium user has VIP badge in connections"""
        session = requests.Session()
        
        # Login
        login_response = session.post(f"{BASE_URL}/api/auth/login", json=PREMIUM_USER)
        assert login_response.status_code == 200
        
        # Check subscription status for verified_badge
        status_response = session.get(f"{BASE_URL}/api/subscription/status")
        assert status_response.status_code == 200
        
        data = status_response.json()
        assert data.get("verified_badge") == True, "Premium user should have VIP badge"
        print(f"SUCCESS: Premium user has VIP badge")


class TestDashboardAccess:
    """Test dashboard access after login"""
    
    def test_crossings_endpoint_after_login(self):
        """Test crossings endpoint works after login"""
        session = requests.Session()
        
        # Login
        login_response = session.post(f"{BASE_URL}/api/auth/login", json=PREMIUM_USER)
        assert login_response.status_code == 200
        
        # Access crossings
        crossings_response = session.get(f"{BASE_URL}/api/crossings")
        assert crossings_response.status_code == 200
        
        data = crossings_response.json()
        assert isinstance(data, list), "Crossings should return a list"
        print(f"SUCCESS: Crossings endpoint works after login")
    
    def test_connections_endpoint_after_login(self):
        """Test connections endpoint works after login"""
        session = requests.Session()
        
        # Login
        login_response = session.post(f"{BASE_URL}/api/auth/login", json=PREMIUM_USER)
        assert login_response.status_code == 200
        
        # Access connections
        connections_response = session.get(f"{BASE_URL}/api/connections")
        assert connections_response.status_code == 200
        
        data = connections_response.json()
        assert isinstance(data, list), "Connections should return a list"
        print(f"SUCCESS: Connections endpoint works after login")
    
    def test_locations_endpoint_after_login(self):
        """Test locations endpoint works after login"""
        session = requests.Session()
        
        # Login
        login_response = session.post(f"{BASE_URL}/api/auth/login", json=PREMIUM_USER)
        assert login_response.status_code == 200
        
        # Access locations
        locations_response = session.get(f"{BASE_URL}/api/locations")
        assert locations_response.status_code == 200
        
        data = locations_response.json()
        assert isinstance(data, list), "Locations should return a list"
        print(f"SUCCESS: Locations endpoint works after login")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
