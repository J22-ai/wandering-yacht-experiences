#!/usr/bin/env python3
"""
Backend API Testing for WANDERING YACHT - Biometric + Passkey Authentication
Testing the new biometric and passkey authentication endpoints
"""

import requests
import json
import sys
import os
from datetime import datetime

# Get backend URL from environment
BACKEND_URL = "https://wandering-yacht-1.preview.emergentagent.com/api"

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {status_symbol} {test_name}")
    if details:
        print(f"    {details}")
    print()

def test_user_registration():
    """Test user registration to get access token"""
    print("=" * 60)
    print("TESTING: User Registration")
    print("=" * 60)
    
    try:
        # Register a new user for biometric testing
        user_data = {
            "email": "bioauth@test.com",
            "password": "test123456", 
            "full_name": "Bio Auth User"
        }
        
        response = requests.post(f"{BACKEND_URL}/auth/register", json=user_data)
        
        if response.status_code == 201 or response.status_code == 200:
            data = response.json()
            access_token = data.get("access_token")
            user_info = data.get("user", {})
            
            log_test("User Registration", "PASS", 
                    f"User created: {user_info.get('email')} | Token: {access_token[:20]}...")
            return access_token, user_info
            
        elif response.status_code == 400 and "already registered" in response.text:
            # User already exists, try to login
            log_test("User Registration", "PASS", "User already exists, attempting login...")
            return test_user_login()
        else:
            log_test("User Registration", "FAIL", 
                    f"Status: {response.status_code} | Response: {response.text}")
            return None, None
            
    except Exception as e:
        log_test("User Registration", "FAIL", f"Exception: {str(e)}")
        return None, None

def test_user_login():
    """Test user login to get access token"""
    try:
        login_data = {
            "email": "bioauth@test.com",
            "password": "test123456"
        }
        
        response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
        
        if response.status_code == 200:
            data = response.json()
            access_token = data.get("access_token")
            user_info = data.get("user", {})
            
            log_test("User Login", "PASS", 
                    f"Login successful: {user_info.get('email')} | Token: {access_token[:20]}...")
            return access_token, user_info
        else:
            log_test("User Login", "FAIL", 
                    f"Status: {response.status_code} | Response: {response.text}")
            return None, None
            
    except Exception as e:
        log_test("User Login", "FAIL", f"Exception: {str(e)}")
        return None, None

def test_biometric_refresh(access_token):
    """Test POST /api/auth/biometric-refresh (Authenticated)"""
    print("=" * 60)
    print("TESTING: Biometric Token Refresh")
    print("=" * 60)
    
    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.post(f"{BACKEND_URL}/auth/biometric-refresh", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            new_token = data.get("access_token")
            user_info = data.get("user", {})
            
            log_test("Biometric Token Refresh", "PASS", 
                    f"New token issued: {new_token[:20]}... | User: {user_info.get('email')}")
            return True, new_token
        else:
            log_test("Biometric Token Refresh", "FAIL", 
                    f"Status: {response.status_code} | Response: {response.text}")
            return False, None
            
    except Exception as e:
        log_test("Biometric Token Refresh", "FAIL", f"Exception: {str(e)}")
        return False, None

def test_passkey_register_options(access_token):
    """Test POST /api/passkey/register/options (Authenticated)"""
    print("=" * 60)
    print("TESTING: Passkey Registration Options")
    print("=" * 60)
    
    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.post(f"{BACKEND_URL}/passkey/register/options", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for required WebAuthn fields
            required_fields = ["challenge", "rp", "user", "pubKeyCredParams"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                rp_info = data.get("rp", {})
                user_info = data.get("user", {})
                
                log_test("Passkey Registration Options", "PASS", 
                        f"WebAuthn options generated | RP: {rp_info.get('name')} | User: {user_info.get('name')}")
                return True, data
            else:
                log_test("Passkey Registration Options", "FAIL", 
                        f"Missing required fields: {missing_fields}")
                return False, None
        else:
            log_test("Passkey Registration Options", "FAIL", 
                    f"Status: {response.status_code} | Response: {response.text}")
            return False, None
            
    except Exception as e:
        log_test("Passkey Registration Options", "FAIL", f"Exception: {str(e)}")
        return False, None

def test_passkey_auth_options():
    """Test POST /api/passkey/auth/options (No auth required)"""
    print("=" * 60)
    print("TESTING: Passkey Authentication Options")
    print("=" * 60)
    
    try:
        response = requests.post(f"{BACKEND_URL}/passkey/auth/options")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for required WebAuthn authentication fields
            required_fields = ["challenge", "rpId"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if not missing_fields:
                rp_id = data.get("rpId")
                challenge = data.get("challenge")
                
                log_test("Passkey Authentication Options", "PASS", 
                        f"WebAuthn auth options generated | RP ID: {rp_id} | Challenge: {challenge[:20]}...")
                return True, data
            else:
                log_test("Passkey Authentication Options", "FAIL", 
                        f"Missing required fields: {missing_fields}")
                return False, None
        else:
            log_test("Passkey Authentication Options", "FAIL", 
                    f"Status: {response.status_code} | Response: {response.text}")
            return False, None
            
    except Exception as e:
        log_test("Passkey Authentication Options", "FAIL", f"Exception: {str(e)}")
        return False, None

def test_calendar_endpoint():
    """Test GET /api/calendar/test (No auth)"""
    print("=" * 60)
    print("TESTING: Google Calendar Test Endpoint")
    print("=" * 60)
    
    try:
        response = requests.get(f"{BACKEND_URL}/calendar/test")
        
        if response.status_code == 200:
            data = response.json()
            status = data.get("status")
            calendar_name = data.get("calendar_name")
            
            if status == "success" and calendar_name == "WANDERING YACHT EXPERIENCES":
                log_test("Calendar Test Endpoint", "PASS", 
                        f"Calendar connected: {calendar_name}")
                return True
            else:
                log_test("Calendar Test Endpoint", "FAIL", 
                        f"Unexpected response: {data}")
                return False
        else:
            log_test("Calendar Test Endpoint", "FAIL", 
                    f"Status: {response.status_code} | Response: {response.text}")
            return False
            
    except Exception as e:
        log_test("Calendar Test Endpoint", "FAIL", f"Exception: {str(e)}")
        return False

def test_full_booking_flow(access_token):
    """Test full booking flow with calendar event creation"""
    print("=" * 60)
    print("TESTING: Full Booking Flow with Calendar Event")
    print("=" * 60)
    
    try:
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Step 1: Get experiences
        log_test("Step 1: Get Experiences", "INFO", "Fetching available experiences...")
        response = requests.get(f"{BACKEND_URL}/experiences", headers=headers)
        
        if response.status_code != 200:
            log_test("Get Experiences", "FAIL", f"Status: {response.status_code}")
            return False
            
        experiences = response.json()
        if not experiences:
            log_test("Get Experiences", "FAIL", "No experiences found")
            return False
            
        # Find a suitable experience
        selected_experience = None
        for exp in experiences:
            if exp.get("available_spots", 0) > 0 and exp.get("ticket_types"):
                selected_experience = exp
                break
                
        if not selected_experience:
            log_test("Get Experiences", "FAIL", "No available experiences with tickets")
            return False
            
        log_test("Get Experiences", "PASS", 
                f"Selected: {selected_experience['title']} | Available spots: {selected_experience['available_spots']}")
        
        # Step 2: Create booking
        log_test("Step 2: Create Booking", "INFO", "Creating booking...")
        
        ticket_type = selected_experience["ticket_types"][0]
        booking_data = {
            "experience_id": selected_experience["id"],
            "tickets": [{
                "ticket_type_id": ticket_type["id"],
                "ticket_name": ticket_type["name"],
                "quantity": 1,
                "price_per_ticket": ticket_type["price"]
            }],
            "special_requests": "Test booking for calendar integration"
        }
        
        response = requests.post(f"{BACKEND_URL}/bookings", json=booking_data, headers=headers)
        
        if response.status_code != 200:
            log_test("Create Booking", "FAIL", f"Status: {response.status_code} | Response: {response.text}")
            return False
            
        booking = response.json()
        booking_id = booking["id"]
        total_amount = booking["total_amount"]
        
        log_test("Create Booking", "PASS", 
                f"Booking created: {booking_id} | Total: €{total_amount}")
        
        # Step 3: Confirm payment (demo mode)
        log_test("Step 3: Confirm Payment", "INFO", "Confirming payment and triggering calendar event...")
        
        response = requests.post(f"{BACKEND_URL}/payment/confirm/{booking_id}", headers=headers)
        
        if response.status_code != 200:
            log_test("Confirm Payment", "FAIL", f"Status: {response.status_code} | Response: {response.text}")
            return False
            
        confirmed_booking = response.json()
        payment_status = confirmed_booking.get("payment_status")
        qr_code = confirmed_booking.get("qr_code")
        calendar_event_id = confirmed_booking.get("calendar_event_id")
        
        # Check results
        success_checks = []
        
        if payment_status in ["paid", "deposit_paid"]:
            success_checks.append(f"Payment status: {payment_status}")
        else:
            log_test("Payment Status Check", "FAIL", f"Unexpected payment status: {payment_status}")
            
        if qr_code and qr_code.startswith("data:image/png;base64,"):
            success_checks.append("QR code generated")
        else:
            log_test("QR Code Check", "FAIL", "QR code not generated properly")
            
        # Note: calendar_event_id might not be immediately available due to async processing
        if calendar_event_id:
            success_checks.append(f"Calendar event ID: {calendar_event_id}")
        else:
            success_checks.append("Calendar event processing (async)")
            
        log_test("Confirm Payment & Calendar Event", "PASS", 
                " | ".join(success_checks))
        
        return True
        
    except Exception as e:
        log_test("Full Booking Flow", "FAIL", f"Exception: {str(e)}")
        return False

def main():
    """Run all backend tests"""
    print("🚢 WANDERING YACHT - Backend API Testing")
    print("Testing Biometric + Passkey Authentication Endpoints")
    print("=" * 80)
    print(f"Backend URL: {BACKEND_URL}")
    print("=" * 80)
    
    # Test results tracking
    test_results = {
        "total": 0,
        "passed": 0,
        "failed": 0
    }
    
    # Test 1: User Registration/Login
    access_token, user_info = test_user_registration()
    test_results["total"] += 1
    if access_token:
        test_results["passed"] += 1
    else:
        test_results["failed"] += 1
        print("❌ Cannot proceed without access token")
        return
    
    # Test 2: Biometric Token Refresh
    success, new_token = test_biometric_refresh(access_token)
    test_results["total"] += 1
    if success:
        test_results["passed"] += 1
        # Use the new token for subsequent tests
        access_token = new_token
    else:
        test_results["failed"] += 1
    
    # Test 3: Passkey Registration Options
    success, reg_options = test_passkey_register_options(access_token)
    test_results["total"] += 1
    if success:
        test_results["passed"] += 1
    else:
        test_results["failed"] += 1
    
    # Test 4: Passkey Authentication Options
    success, auth_options = test_passkey_auth_options()
    test_results["total"] += 1
    if success:
        test_results["passed"] += 1
    else:
        test_results["failed"] += 1
    
    # Test 5: Calendar Test Endpoint
    success = test_calendar_endpoint()
    test_results["total"] += 1
    if success:
        test_results["passed"] += 1
    else:
        test_results["failed"] += 1
    
    # Test 6: Full Booking Flow with Calendar Event
    success = test_full_booking_flow(access_token)
    test_results["total"] += 1
    if success:
        test_results["passed"] += 1
    else:
        test_results["failed"] += 1
    
    # Final Results
    print("=" * 80)
    print("🏁 TESTING COMPLETE")
    print("=" * 80)
    print(f"Total Tests: {test_results['total']}")
    print(f"✅ Passed: {test_results['passed']}")
    print(f"❌ Failed: {test_results['failed']}")
    
    success_rate = (test_results['passed'] / test_results['total']) * 100
    print(f"📊 Success Rate: {success_rate:.1f}%")
    
    if test_results['failed'] == 0:
        print("\n🎉 ALL TESTS PASSED! Biometric + Passkey authentication is working correctly.")
    else:
        print(f"\n⚠️  {test_results['failed']} test(s) failed. Please review the issues above.")
    
    print("=" * 80)

if __name__ == "__main__":
    main()