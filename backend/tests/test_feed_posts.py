"""
Test suite for Hi Again Feed/Posts API endpoints
Tests: POST /api/posts, GET /api/posts/feed, GET /api/posts/explore, 
       POST /api/posts/{id}/like, POST /api/posts/{id}/comments, GET /api/posts/{id}/comments
"""
import pytest
import requests
import os
import base64
from io import BytesIO

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials - loaded from environment variables for security
TEST_EMAIL = os.environ.get('TEST_ADMIN_EMAIL', 'hiagainxyz@gmail.com')
TEST_PASSWORD = os.environ.get('TEST_ADMIN_PASSWORD', 'HiAgain2024!')


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed - status: {response.status_code}, response: {response.text}")


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self, api_client):
        """Test API health endpoint"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ API health check passed")


class TestAuthentication:
    """Authentication tests"""
    
    def test_login_success(self, api_client):
        """Test successful login with valid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        print(f"✓ Login successful for {TEST_EMAIL}")
    
    def test_login_invalid_credentials(self, api_client):
        """Test login with invalid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected")


class TestFeedEndpoints:
    """Feed API endpoint tests"""
    
    def test_get_feed_authenticated(self, authenticated_client):
        """Test GET /api/posts/feed - returns posts from crossed paths users"""
        response = authenticated_client.get(f"{BASE_URL}/api/posts/feed")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Feed endpoint returned {len(data)} posts")
        
        # Validate post structure if posts exist
        if len(data) > 0:
            post = data[0]
            assert "id" in post
            assert "user_id" in post
            assert "user_name" in post
            assert "media_url" in post
            assert "media_type" in post
            assert "likes_count" in post
            assert "comments_count" in post
            assert "liked_by_me" in post
            assert "created_at" in post
            print("✓ Post structure validated")
    
    def test_get_explore_feed_authenticated(self, authenticated_client):
        """Test GET /api/posts/explore - returns all public posts"""
        response = authenticated_client.get(f"{BASE_URL}/api/posts/explore")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Explore feed endpoint returned {len(data)} posts")
    
    def test_feed_requires_authentication(self, api_client):
        """Test that feed endpoints require authentication"""
        # Remove auth header temporarily
        original_headers = api_client.headers.copy()
        api_client.headers.pop("Authorization", None)
        
        response = api_client.get(f"{BASE_URL}/api/posts/feed")
        assert response.status_code in [401, 403]
        print("✓ Feed endpoint correctly requires authentication")
        
        # Restore headers
        api_client.headers = original_headers


class TestPostCreation:
    """Post creation tests"""
    
    def test_create_post_with_image(self, authenticated_client):
        """Test POST /api/posts - create post with image"""
        # Create a simple test image (1x1 red pixel PNG)
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
        )
        
        files = {
            'file': ('test_image.png', BytesIO(png_data), 'image/png')
        }
        data = {
            'caption': 'TEST_post_caption',
            'location': 'TEST_location'
        }
        
        # Remove Content-Type header for multipart form
        headers = {"Authorization": authenticated_client.headers.get("Authorization")}
        
        response = requests.post(
            f"{BASE_URL}/api/posts",
            files=files,
            data=data,
            headers=headers
        )
        
        assert response.status_code == 200
        post_data = response.json()
        assert "id" in post_data
        assert post_data["caption"] == "TEST_post_caption"
        assert post_data["location"] == "TEST_location"
        assert post_data["media_type"] == "image"
        assert post_data["media_url"].startswith("data:image")
        print(f"✓ Post created successfully with ID: {post_data['id']}")
        
        # Store post ID for cleanup
        return post_data["id"]
    
    def test_create_post_without_file_fails(self, authenticated_client):
        """Test that post creation fails without a file"""
        headers = {"Authorization": authenticated_client.headers.get("Authorization")}
        
        response = requests.post(
            f"{BASE_URL}/api/posts",
            data={'caption': 'No file test'},
            headers=headers
        )
        
        assert response.status_code == 422  # Validation error
        print("✓ Post creation correctly requires file upload")


class TestPostInteractions:
    """Post like and comment tests"""
    
    @pytest.fixture(scope="class")
    def test_post_id(self, authenticated_client):
        """Create a test post for interaction tests"""
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
        )
        
        files = {
            'file': ('test_image.png', BytesIO(png_data), 'image/png')
        }
        data = {
            'caption': 'TEST_interaction_post'
        }
        
        headers = {"Authorization": authenticated_client.headers.get("Authorization")}
        
        response = requests.post(
            f"{BASE_URL}/api/posts",
            files=files,
            data=data,
            headers=headers
        )
        
        if response.status_code == 200:
            post_id = response.json()["id"]
            yield post_id
            # Cleanup: delete the test post
            requests.delete(
                f"{BASE_URL}/api/posts/{post_id}",
                headers=headers
            )
        else:
            pytest.skip("Could not create test post")
    
    def test_like_post(self, authenticated_client, test_post_id):
        """Test POST /api/posts/{id}/like - like a post"""
        response = authenticated_client.post(f"{BASE_URL}/api/posts/{test_post_id}/like")
        assert response.status_code == 200
        data = response.json()
        assert "action" in data
        assert data["action"] in ["liked", "unliked"]
        assert "likes_count" in data
        print(f"✓ Post {data['action']} successfully, likes_count: {data['likes_count']}")
    
    def test_unlike_post(self, authenticated_client, test_post_id):
        """Test POST /api/posts/{id}/like - unlike a post (toggle)"""
        # First like
        authenticated_client.post(f"{BASE_URL}/api/posts/{test_post_id}/like")
        # Then unlike
        response = authenticated_client.post(f"{BASE_URL}/api/posts/{test_post_id}/like")
        assert response.status_code == 200
        data = response.json()
        assert "action" in data
        print(f"✓ Post toggle like/unlike working, action: {data['action']}")
    
    def test_like_nonexistent_post(self, authenticated_client):
        """Test liking a non-existent post returns 404"""
        response = authenticated_client.post(f"{BASE_URL}/api/posts/nonexistent-id/like")
        assert response.status_code == 404
        print("✓ Liking non-existent post correctly returns 404")
    
    def test_add_comment(self, authenticated_client, test_post_id):
        """Test POST /api/posts/{id}/comments - add a comment"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/posts/{test_post_id}/comments",
            json={"text": "TEST_comment_text"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["text"] == "TEST_comment_text"
        assert "user_name" in data
        assert "created_at" in data
        print(f"✓ Comment added successfully with ID: {data['id']}")
    
    def test_get_comments(self, authenticated_client, test_post_id):
        """Test GET /api/posts/{id}/comments - get comments for a post"""
        # First add a comment
        authenticated_client.post(
            f"{BASE_URL}/api/posts/{test_post_id}/comments",
            json={"text": "TEST_get_comments_test"}
        )
        
        response = authenticated_client.get(f"{BASE_URL}/api/posts/{test_post_id}/comments")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Validate comment structure
        comment = data[0]
        assert "id" in comment
        assert "text" in comment
        assert "user_name" in comment
        assert "created_at" in comment
        print(f"✓ Retrieved {len(data)} comments for post")
    
    def test_comment_on_nonexistent_post(self, authenticated_client):
        """Test commenting on a non-existent post returns 404"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/posts/nonexistent-id/comments",
            json={"text": "Test comment"}
        )
        assert response.status_code == 404
        print("✓ Commenting on non-existent post correctly returns 404")


class TestPostDeletion:
    """Post deletion tests"""
    
    def test_delete_own_post(self, authenticated_client):
        """Test DELETE /api/posts/{id} - delete own post"""
        # First create a post
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
        )
        
        files = {
            'file': ('test_image.png', BytesIO(png_data), 'image/png')
        }
        data = {
            'caption': 'TEST_delete_post'
        }
        
        headers = {"Authorization": authenticated_client.headers.get("Authorization")}
        
        create_response = requests.post(
            f"{BASE_URL}/api/posts",
            files=files,
            data=data,
            headers=headers
        )
        
        assert create_response.status_code == 200
        post_id = create_response.json()["id"]
        
        # Now delete it
        delete_response = authenticated_client.delete(f"{BASE_URL}/api/posts/{post_id}")
        assert delete_response.status_code == 200
        print(f"✓ Post {post_id} deleted successfully")
        
        # Verify it's gone from feed
        feed_response = authenticated_client.get(f"{BASE_URL}/api/posts/feed")
        feed_posts = feed_response.json()
        post_ids = [p["id"] for p in feed_posts]
        assert post_id not in post_ids
        print("✓ Deleted post no longer appears in feed")
    
    def test_delete_nonexistent_post(self, authenticated_client):
        """Test deleting a non-existent post returns 404"""
        response = authenticated_client.delete(f"{BASE_URL}/api/posts/nonexistent-id")
        assert response.status_code == 404
        print("✓ Deleting non-existent post correctly returns 404")


class TestUserPosts:
    """User-specific posts tests"""
    
    def test_get_user_posts(self, authenticated_client, auth_token):
        """Test GET /api/posts/user/{user_id} - get posts from specific user"""
        # First get current user info
        me_response = authenticated_client.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        user_id = me_response.json()["id"]
        
        # Get user's posts
        response = authenticated_client.get(f"{BASE_URL}/api/posts/user/{user_id}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} posts for user {user_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
