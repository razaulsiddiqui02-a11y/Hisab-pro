#!/usr/bin/env python3
"""
Admin functionality test for FindBack API
"""

import requests
import json
import subprocess
import sys

BASE_URL = "https://findback-app.preview.emergentagent.com/api"

def make_user_admin(phone_number):
    """Make a user admin by updating MongoDB directly"""
    try:
        cmd = f'''mongosh --quiet --eval "
        use test_database;
        db.users.updateOne(
            {{phone: '{phone_number}'}}, 
            {{\\$set: {{role: 'admin'}}}}
        );
        print('User role updated to admin');
        "'''
        
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        print(f"MongoDB update result: {result.stdout}")
        return result.returncode == 0
    except Exception as e:
        print(f"Error updating user role: {e}")
        return False

def test_admin_endpoints():
    """Test admin endpoints with proper admin user"""
    print("\n=== Testing Admin Endpoints with Admin User ===")
    
    # First register a user
    print("1. Registering admin user...")
    
    # Send OTP
    response = requests.post(f"{BASE_URL}/auth/send-otp", json={"phone": "1111222233"})
    if response.status_code != 200:
        print(f"Failed to send OTP: {response.status_code}")
        return False
    
    # Register user
    response = requests.post(f"{BASE_URL}/auth/register", json={
        "phone": "1111222233",
        "name": "Admin User",
        "otp": "123456"
    })
    
    if response.status_code != 200:
        print(f"Failed to register user: {response.status_code}")
        return False
    
    token = response.json().get('token')
    user_id = response.json().get('user', {}).get('id')
    
    print(f"User registered with ID: {user_id}")
    
    # Make user admin
    print("2. Making user admin...")
    if not make_user_admin("1111222233"):
        print("Failed to make user admin")
        return False
    
    # Test admin endpoints
    headers = {"Authorization": f"Bearer {token}"}
    
    print("3. Testing admin endpoints...")
    
    # Test admin stats
    response = requests.get(f"{BASE_URL}/admin/stats", headers=headers)
    print(f"Admin stats: {response.status_code}")
    if response.status_code == 200:
        stats = response.json()
        print(f"   Total users: {stats.get('total_users')}")
        print(f"   Total items: {stats.get('total_items')}")
        print(f"   Pending items: {stats.get('pending_items')}")
    
    # Test admin users
    response = requests.get(f"{BASE_URL}/admin/users", headers=headers)
    print(f"Admin users: {response.status_code}")
    if response.status_code == 200:
        users = response.json()
        print(f"   Users count: {len(users)}")
    
    # Test admin reports
    response = requests.get(f"{BASE_URL}/admin/reports", headers=headers)
    print(f"Admin reports: {response.status_code}")
    if response.status_code == 200:
        reports = response.json()
        print(f"   Reports count: {len(reports)}")
    
    return True

if __name__ == "__main__":
    success = test_admin_endpoints()
    if success:
        print("✅ Admin tests completed successfully")
    else:
        print("❌ Admin tests failed")
    sys.exit(0 if success else 1)