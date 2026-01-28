#!/usr/bin/env python3
"""
Test admin endpoints with existing admin user
"""

import requests
import json

BASE_URL = "https://findback-app.preview.emergentagent.com/api"

def test_admin_with_existing_user():
    """Test admin endpoints with existing admin user"""
    
    # Login as the admin user
    print("1. Logging in as admin user...")
    
    # Send OTP
    response = requests.post(f"{BASE_URL}/auth/send-otp", json={"phone": "1111222233"})
    if response.status_code != 200:
        print(f"Failed to send OTP: {response.status_code}")
        return False
    
    # Verify OTP (this will login since user exists)
    response = requests.post(f"{BASE_URL}/auth/verify-otp", json={
        "phone": "1111222233",
        "otp": "123456"
    })
    
    if response.status_code != 200:
        print(f"Failed to login: {response.status_code} - {response.text}")
        return False
    
    token = response.json().get('token')
    user = response.json().get('user')
    
    print(f"Logged in as: {user.get('name')} (Role: {user.get('role')})")
    
    # Test admin endpoints
    headers = {"Authorization": f"Bearer {token}"}
    
    print("2. Testing admin endpoints...")
    
    # Test admin stats
    response = requests.get(f"{BASE_URL}/admin/stats", headers=headers)
    print(f"✅ Admin stats: {response.status_code}")
    if response.status_code == 200:
        stats = response.json()
        print(f"   Total users: {stats.get('total_users')}")
        print(f"   Total items: {stats.get('total_items')}")
        print(f"   Pending items: {stats.get('pending_items')}")
        print(f"   Approved items: {stats.get('approved_items')}")
        print(f"   Resolved cases: {stats.get('resolved_cases')}")
        print(f"   Pending reports: {stats.get('pending_reports')}")
    
    # Test admin users
    response = requests.get(f"{BASE_URL}/admin/users", headers=headers)
    print(f"✅ Admin users: {response.status_code}")
    if response.status_code == 200:
        users = response.json()
        print(f"   Users count: {len(users)}")
    
    # Test admin items
    response = requests.get(f"{BASE_URL}/admin/items", headers=headers)
    print(f"✅ Admin items: {response.status_code}")
    if response.status_code == 200:
        items = response.json()
        print(f"   Items count: {len(items)}")
        
        # Test approving an item if any exist
        if items:
            item_id = items[0]['id']
            print(f"3. Testing item approval for item: {item_id}")
            response = requests.put(f"{BASE_URL}/admin/items/{item_id}", 
                                  json={"status": "approved"}, headers=headers)
            print(f"✅ Item approval: {response.status_code}")
    
    # Test admin reports
    response = requests.get(f"{BASE_URL}/admin/reports", headers=headers)
    print(f"✅ Admin reports: {response.status_code}")
    if response.status_code == 200:
        reports = response.json()
        print(f"   Reports count: {len(reports)}")
    
    return True

if __name__ == "__main__":
    success = test_admin_with_existing_user()
    if success:
        print("\n🎉 All admin tests passed!")
    else:
        print("\n❌ Admin tests failed")