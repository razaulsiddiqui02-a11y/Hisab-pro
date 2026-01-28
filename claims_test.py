#!/usr/bin/env python3
"""
Test complete claims and chat flow with approved item
"""

import requests
import json

BASE_URL = "https://findback-app.preview.emergentagent.com/api"

def test_complete_claims_flow():
    """Test complete claims and chat flow"""
    
    print("=== Testing Complete Claims and Chat Flow ===")
    
    # Login as owner user
    print("1. Logging in as owner user...")
    
    # Send OTP
    response = requests.post(f"{BASE_URL}/auth/send-otp", json={"phone": "8888777766"})
    if response.status_code != 200:
        print(f"Failed to send OTP: {response.status_code}")
        return False
    
    # Verify OTP
    response = requests.post(f"{BASE_URL}/auth/verify-otp", json={
        "phone": "8888777766",
        "otp": "123456"
    })
    
    if response.status_code != 200:
        print(f"Failed to login: {response.status_code}")
        return False
    
    owner_token = response.json().get('token')
    headers = {"Authorization": f"Bearer {owner_token}"}
    
    print("2. Getting approved items...")
    
    # Get approved items
    response = requests.get(f"{BASE_URL}/items", headers=headers)
    if response.status_code != 200:
        print(f"Failed to get items: {response.status_code}")
        return False
    
    items = response.json()
    print(f"   Found {len(items)} approved items")
    
    if not items:
        print("   No approved items available for claiming")
        return False
    
    item_id = items[0]['id']
    print(f"   Testing with item: {item_id}")
    
    print("3. Creating claim...")
    
    # Create claim
    claim_data = {
        "item_id": item_id,
        "answers": ["Blue", "Nature scene"]
    }
    
    response = requests.post(f"{BASE_URL}/claims", json=claim_data, headers=headers)
    print(f"   Claim creation: {response.status_code}")
    
    if response.status_code != 200:
        print(f"   Failed to create claim: {response.text}")
        return False
    
    claim = response.json()
    claim_id = claim.get('id')
    print(f"   Created claim: {claim_id}")
    
    print("4. Testing claims list...")
    
    # Get claims
    response = requests.get(f"{BASE_URL}/claims", headers=headers)
    print(f"   Get claims: {response.status_code}")
    if response.status_code == 200:
        claims = response.json()
        print(f"   Claims count: {len(claims)}")
    
    print("5. Testing claim details...")
    
    # Get claim details
    response = requests.get(f"{BASE_URL}/claims/{claim_id}", headers=headers)
    print(f"   Get claim details: {response.status_code}")
    
    print("6. Testing chat functionality...")
    
    # Get chats (should have one now)
    response = requests.get(f"{BASE_URL}/chats", headers=headers)
    print(f"   Get chats: {response.status_code}")
    
    if response.status_code == 200:
        chats = response.json()
        print(f"   Chats count: {len(chats)}")
        
        if chats:
            chat_id = chats[0]['id']
            print(f"   Testing with chat: {chat_id}")
            
            # Get chat messages
            response = requests.get(f"{BASE_URL}/chats/{chat_id}", headers=headers)
            print(f"   Get chat messages: {response.status_code}")
            
            # Send message
            message_data = {"content": "Hello! I believe this is my phone. The case is blue and wallpaper shows a nature scene."}
            response = requests.post(f"{BASE_URL}/chats/{chat_id}/messages", json=message_data, headers=headers)
            print(f"   Send message: {response.status_code}")
            
            if response.status_code == 200:
                message = response.json()
                print(f"   Message sent: {message.get('content')[:50]}...")
    
    print("7. Testing finder's view of claim...")
    
    # Login as finder to test their view
    response = requests.post(f"{BASE_URL}/auth/send-otp", json={"phone": "9999888877"})
    response = requests.post(f"{BASE_URL}/auth/verify-otp", json={
        "phone": "9999888877",
        "otp": "123456"
    })
    
    finder_token = response.json().get('token')
    finder_headers = {"Authorization": f"Bearer {finder_token}"}
    
    # Get claim details as finder (should see answers)
    response = requests.get(f"{BASE_URL}/claims/{claim_id}", headers=finder_headers)
    print(f"   Finder view of claim: {response.status_code}")
    
    if response.status_code == 200:
        claim_detail = response.json()
        if 'qa_pairs' in claim_detail:
            print(f"   Q&A pairs available: {len(claim_detail['qa_pairs'])}")
            for qa in claim_detail['qa_pairs']:
                correct = qa['correct_answer'] == qa['given_answer']
                print(f"   Q: {qa['question'][:30]}... - {'✅' if correct else '❌'}")
    
    # Test claim approval
    print("8. Testing claim approval...")
    response = requests.put(f"{BASE_URL}/claims/{claim_id}", 
                          json={"status": "approved"}, headers=finder_headers)
    print(f"   Claim approval: {response.status_code}")
    
    return True

if __name__ == "__main__":
    success = test_complete_claims_flow()
    if success:
        print("\n🎉 Complete claims and chat flow test passed!")
    else:
        print("\n❌ Claims and chat flow test failed")