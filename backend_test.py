#!/usr/bin/env python3
"""
Anti-Bot Registration Protection Testing
Tests the backend anti-bot features for registration endpoint.
"""

import requests
import time
import json
import uuid
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://wandering-yacht-1.preview.emergentagent.com/api"

def generate_unique_email():
    """Generate a unique email for testing"""
    return f"test_{uuid.uuid4().hex[:8]}@example.com"

def test_normal_registration_with_antibot():
    """Test 1: Normal registration with anti-bot fields (should SUCCEED)"""
    print("\n=== Test 1: Normal registration with anti-bot fields ===")
    
    email = generate_unique_email()
    form_loaded_at = str(time.time() - 10)  # 10 seconds ago
    
    payload = {
        "email": email,
        "password": "test123456",
        "full_name": "Test User",
        "website": "",  # Empty honeypot (correct)
        "form_loaded_at": form_loaded_at
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/register", json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if "access_token" in data and "user" in data:
                print("✅ SUCCESS: Normal registration with anti-bot fields works")
                return email, data["access_token"]
            else:
                print("❌ FAIL: Response missing required fields")
                return None, None
        else:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return None, None
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return None, None

def test_registration_without_antibot():
    """Test 2: Registration WITHOUT anti-bot fields (should still SUCCEED)"""
    print("\n=== Test 2: Registration without anti-bot fields ===")
    
    email = generate_unique_email()
    
    payload = {
        "email": email,
        "password": "test123456",
        "full_name": "No Bot Fields"
        # No website or form_loaded_at fields
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/register", json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if "access_token" in data and "user" in data:
                print("✅ SUCCESS: Registration without anti-bot fields works")
                return True
            else:
                print("❌ FAIL: Response missing required fields")
                return False
        else:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def test_honeypot_filled():
    """Test 3: Honeypot filled (should FAIL with 400)"""
    print("\n=== Test 3: Honeypot filled (bot detected) ===")
    
    email = generate_unique_email()
    form_loaded_at = str(time.time() - 10)
    
    payload = {
        "email": email,
        "password": "test123456",
        "full_name": "Bot User",
        "website": "http://spam.com",  # Honeypot filled (bot behavior)
        "form_loaded_at": form_loaded_at
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/register", json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 400:
            print("✅ SUCCESS: Honeypot detection works (bot rejected)")
            return True
        else:
            print(f"❌ FAIL: Expected 400, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def test_too_fast_submission():
    """Test 4: Too-fast submission (should FAIL with 400)"""
    print("\n=== Test 4: Too-fast submission (bot detected) ===")
    
    email = generate_unique_email()
    form_loaded_at = str(time.time())  # Just now (too fast)
    
    payload = {
        "email": email,
        "password": "test123456",
        "full_name": "Fast Bot",
        "website": "",  # Empty honeypot
        "form_loaded_at": form_loaded_at
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/register", json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 400:
            print("✅ SUCCESS: Fast submission detection works (bot rejected)")
            return True
        else:
            print(f"❌ FAIL: Expected 400, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def test_existing_login(email, password="test123456"):
    """Test 5: Existing login still works"""
    print("\n=== Test 5: Existing login still works ===")
    
    if not email:
        print("❌ SKIP: No email from previous test")
        return False
    
    payload = {
        "email": email,
        "password": password
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/auth/login", json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if "access_token" in data and "user" in data:
                print("✅ SUCCESS: Login works for registered user")
                return True
            else:
                print("❌ FAIL: Response missing required fields")
                return False
        else:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def main():
    """Run all anti-bot registration tests"""
    print("🚀 Starting Anti-Bot Registration Protection Tests")
    print(f"Backend URL: {BACKEND_URL}")
    
    results = []
    
    # Test 1: Normal registration with anti-bot fields
    test_email, token = test_normal_registration_with_antibot()
    results.append(test_email is not None and token is not None)
    
    # Test 2: Registration without anti-bot fields
    results.append(test_registration_without_antibot())
    
    # Test 3: Honeypot filled
    results.append(test_honeypot_filled())
    
    # Test 4: Too-fast submission
    results.append(test_too_fast_submission())
    
    # Test 5: Existing login
    results.append(test_existing_login(test_email))
    
    # Summary
    print("\n" + "="*60)
    print("📊 ANTI-BOT REGISTRATION TEST SUMMARY")
    print("="*60)
    
    test_names = [
        "Normal registration with anti-bot fields",
        "Registration without anti-bot fields", 
        "Honeypot filled (should fail)",
        "Too-fast submission (should fail)",
        "Existing login works"
    ]
    
    passed = sum(results)
    total = len(results)
    
    for i, (name, result) in enumerate(zip(test_names, results), 1):
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{i}. {name}: {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Anti-bot protection working correctly!")
        return True
    else:
        print("⚠️  SOME TESTS FAILED - Anti-bot protection needs attention")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)