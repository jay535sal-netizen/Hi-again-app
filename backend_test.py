#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timezone
import time
import uuid

class HiAgainAPITester:
    def __init__(self, base_url="https://crossed-paths-3.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "name": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            
            if success:
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    self.log_test(name, True)
                    return True, response_data
                except:
                    self.log_test(name, True, "No JSON response")
                    return True, {}
            else:
                try:
                    error_data = response.json()
                    error_msg = f"Expected {expected_status}, got {response.status_code}: {error_data}"
                except:
                    error_msg = f"Expected {expected_status}, got {response.status_code}: {response.text[:100]}"
                
                self.log_test(name, False, error_msg)
                return False, {}

        except Exception as e:
            error_msg = f"Request failed: {str(e)}"
            self.log_test(name, False, error_msg)
            return False, {}

    def test_health_check(self):
        """Test API health endpoints"""
        print("\n" + "="*50)
        print("TESTING HEALTH ENDPOINTS")
        print("="*50)
        
        self.run_test("Health Check", "GET", "", 200)
        self.run_test("Health Status", "GET", "health", 200)

    def test_user_registration(self):
        """Test user registration"""
        print("\n" + "="*50)
        print("TESTING USER REGISTRATION")
        print("="*50)
        
        # Generate unique test user
        timestamp = int(time.time())
        test_email = f"test_user_{timestamp}@example.com"
        test_name = f"Test User {timestamp}"
        test_password = "TestPass123!"
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "email": test_email,
                "name": test_name,
                "password": test_password
            }
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            self.test_email = test_email
            self.test_password = test_password
            print(f"   ✅ Got token: {self.token[:20]}...")
            print(f"   ✅ User ID: {self.user_id}")
            return True
        
        return False

    def test_duplicate_registration(self):
        """Test duplicate email registration"""
        if not hasattr(self, 'test_email'):
            print("⚠️  Skipping duplicate registration test - no test email available")
            return
            
        self.run_test(
            "Duplicate Registration (should fail)",
            "POST", 
            "auth/register",
            400,
            data={
                "email": self.test_email,
                "name": "Another User",
                "password": "AnotherPass123!"
            }
        )

    def test_user_login(self):
        """Test user login"""
        print("\n" + "="*50)
        print("TESTING USER LOGIN")
        print("="*50)
        
        if not hasattr(self, 'test_email'):
            print("⚠️  Skipping login test - no test credentials available")
            return False
            
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login", 
            200,
            data={
                "email": self.test_email,
                "password": self.test_password
            }
        )
        
        if success and 'access_token' in response:
            # Update token from login
            self.token = response['access_token']
            print(f"   ✅ Login token: {self.token[:20]}...")
            return True
        
        return False

    def test_invalid_login(self):
        """Test invalid login credentials"""
        self.run_test(
            "Invalid Login (should fail)",
            "POST",
            "auth/login",
            401,
            data={
                "email": "nonexistent@test.com",
                "password": "wrongpassword"
            }
        )

    def test_get_current_user(self):
        """Test getting current user info"""
        print("\n" + "="*50)
        print("TESTING USER INFO")
        print("="*50)
        
        if not self.token:
            print("⚠️  Skipping user info test - no auth token")
            return
            
        self.run_test("Get Current User", "GET", "auth/me", 200)

    def test_location_management(self):
        """Test location CRUD operations"""
        print("\n" + "="*50)
        print("TESTING LOCATION MANAGEMENT")
        print("="*50)
        
        if not self.token:
            print("⚠️  Skipping location tests - no auth token")
            return
        
        # Test adding a location
        location_data = {
            "latitude": 40.7128,
            "longitude": -74.0060,
            "name": "Test Location NYC",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        success, response = self.run_test(
            "Add Location",
            "POST",
            "locations",
            200,
            data=location_data
        )
        
        location_id = None
        if success and 'id' in response:
            location_id = response['id']
            print(f"   ✅ Created location ID: {location_id}")
        
        # Test getting locations
        self.run_test("Get Locations", "GET", "locations", 200)
        
        # Test adding another location for crossing detection
        location_data2 = {
            "latitude": 40.7130,  # Very close to first location
            "longitude": -74.0062,
            "name": "Test Location NYC 2",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        success2, response2 = self.run_test(
            "Add Second Location",
            "POST", 
            "locations",
            200,
            data=location_data2
        )
        
        location_id2 = None
        if success2 and 'id' in response2:
            location_id2 = response2['id']
        
        # Test deleting a location
        if location_id:
            self.run_test(
                "Delete Location",
                "DELETE",
                f"locations/{location_id}",
                200
            )
        
        return location_id2  # Return the remaining location ID

    def test_crossings(self):
        """Test path crossing detection"""
        print("\n" + "="*50)
        print("TESTING PATH CROSSINGS")
        print("="*50)
        
        if not self.token:
            print("⚠️  Skipping crossings tests - no auth token")
            return
        
        # Get crossings
        self.run_test("Get Crossings", "GET", "crossings", 200)
        
        # Get crossing stats
        self.run_test("Get Crossing Stats", "GET", "crossings/stats", 200)

    def test_connections(self):
        """Test connection management"""
        print("\n" + "="*50)
        print("TESTING CONNECTIONS")
        print("="*50)
        
        if not self.token:
            print("⚠️  Skipping connections tests - no auth token")
            return
        
        # Get connections
        self.run_test("Get Connections", "GET", "connections", 200)
        
        # Test creating connection (will fail since we need another user)
        fake_user_id = str(uuid.uuid4())
        success, response = self.run_test(
            "Create Connection (should fail - user not found)",
            "POST",
            "connections",
            404,
            data={
                "target_user_id": fake_user_id,
                "message": "Test connection message"
            }
        )

    def test_profile_management(self):
        """Test profile updates"""
        print("\n" + "="*50)
        print("TESTING PROFILE MANAGEMENT")
        print("="*50)
        
        if not self.token:
            print("⚠️  Skipping profile tests - no auth token")
            return
        
        # Update profile
        self.run_test(
            "Update Profile",
            "PATCH",
            "profile",
            200,
            data={
                "name": "Updated Test User",
                "avatar_url": "https://example.com/avatar.jpg"
            }
        )

    def test_unauthorized_access(self):
        """Test endpoints without authentication"""
        print("\n" + "="*50)
        print("TESTING UNAUTHORIZED ACCESS")
        print("="*50)
        
        # Temporarily remove token
        original_token = self.token
        self.token = None
        
        self.run_test("Unauthorized Get User (should fail)", "GET", "auth/me", 403)
        self.run_test("Unauthorized Get Locations (should fail)", "GET", "locations", 403)
        self.run_test("Unauthorized Get Crossings (should fail)", "GET", "crossings", 403)
        
        # Restore token
        self.token = original_token

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Hi Again API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print(f"⏰ Started at: {datetime.now()}")
        
        # Test sequence
        self.test_health_check()
        
        if self.test_user_registration():
            self.test_duplicate_registration()
            self.test_user_login()
            self.test_invalid_login()
            self.test_get_current_user()
            self.test_location_management()
            self.test_crossings()
            self.test_connections()
            self.test_profile_management()
            self.test_unauthorized_access()
        else:
            print("❌ Registration failed, skipping authenticated tests")
        
        # Print summary
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"📊 Tests run: {self.tests_run}")
        print(f"✅ Tests passed: {self.tests_passed}")
        print(f"❌ Tests failed: {self.tests_run - self.tests_passed}")
        print(f"📈 Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.tests_passed < self.tests_run:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   • {result['name']}: {result['details']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = HiAgainAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())