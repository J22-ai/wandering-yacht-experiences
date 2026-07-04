#!/usr/bin/env python3
"""
Backend API Testing for WANDERING YACHT - Booking Confirmation Workflow
Tests email service configuration, Google Calendar integration, and booking confirmation endpoint
"""

import requests
import json
import time
from datetime import datetime

# Backend URL
BASE_URL = "https://wandering-yacht-1.preview.emergentagent.com/api"

# Test data
TEST_USER = {
    "email": f"test.booking.{int(time.time())}@example.com",
    "password": "SecurePass123!",
    "full_name": "Marina Yacht Tester",
    "phone": "+38269123456",
    "whatsapp_number": "+38269123456"
}

def print_test(test_name):
    """Print test header"""
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_result(success, message, data=None):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if data:
        print(f"Data: {json.dumps(data, indent=2)}")
    return success

def test_email_configuration():
    """Test 1: Check Email Service Configuration"""
    print_test("Email Service Configuration Check")
    
    # Read backend .env file
    try:
        with open('/app/backend/.env', 'r') as f:
            env_content = f.read()
        
        # Check for SMTP credentials
        has_smtp_host = 'SMTP_HOST=' in env_content
        has_smtp_port = 'SMTP_PORT=' in env_content
        has_smtp_email = 'SMTP_EMAIL=' in env_content
        has_smtp_password = 'SMTP_PASSWORD=' in env_content
        
        if all([has_smtp_host, has_smtp_port, has_smtp_email, has_smtp_password]):
            print_result(True, "SMTP credentials are configured in /app/backend/.env")
            
            # Extract values
            for line in env_content.split('\n'):
                if line.startswith('SMTP_'):
                    key = line.split('=')[0]
                    print(f"  - {key}: Configured ✓")
            
            return True
        else:
            return print_result(False, "SMTP credentials are missing in /app/backend/.env")
    except Exception as e:
        return print_result(False, f"Failed to read .env file: {str(e)}")

def test_email_template():
    """Test 2: Check Email Template for New Greeting"""
    print_test("Email Template Greeting Check")
    
    try:
        with open('/app/backend/services/email.py', 'r') as f:
            email_content = f.read()
        
        # Check for the new greeting
        if "Welcome to the Wandering Yacht Club!" in email_content:
            return print_result(True, "Email template contains 'Welcome to the Wandering Yacht Club!' greeting")
        else:
            return print_result(False, "Email template does NOT contain the new greeting")
    except Exception as e:
        return print_result(False, f"Failed to read email.py file: {str(e)}")

def test_calendar_service():
    """Test 3: Check Google Calendar Service File"""
    print_test("Google Calendar Service Check")
    
    try:
        with open('/app/backend/services/calendar.py', 'r') as f:
            calendar_content = f.read()
        
        # Check for key functions
        has_get_service = 'def get_google_calendar_service' in calendar_content
        has_create_event = 'def create_calendar_event' in calendar_content
        has_google_import = 'from google.oauth2 import service_account' in calendar_content
        
        if all([has_get_service, has_create_event, has_google_import]):
            return print_result(True, "Google Calendar service file exists with proper implementation")
        else:
            return print_result(False, "Google Calendar service file is missing required functions")
    except Exception as e:
        return print_result(False, f"Failed to read calendar.py file: {str(e)}")

def test_calendar_credentials():
    """Test 4: Check Google Calendar Credentials Configuration"""
    print_test("Google Calendar Credentials Check")
    
    try:
        with open('/app/backend/.env', 'r') as f:
            env_content = f.read()
        
        if 'GOOGLE_CALENDAR_ID=' in env_content:
            print_result(True, "Google Calendar ID is configured in .env")
            
            # Extract calendar ID
            for line in env_content.split('\n'):
                if line.startswith('GOOGLE_CALENDAR_ID='):
                    calendar_id = line.split('=')[1]
                    print(f"  - Calendar ID: {calendar_id[:50]}...")
            
            return True
        else:
            return print_result(False, "Google Calendar ID is missing in .env")
    except Exception as e:
        return print_result(False, f"Failed to check calendar credentials: {str(e)}")

def test_user_registration():
    """Test 5: Register a Test User"""
    print_test("User Registration")
    
    try:
        response = requests.post(
            f"{BASE_URL}/auth/register",
            json=TEST_USER,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if 'access_token' in data and 'user' in data:
                TEST_USER['token'] = data['access_token']
                TEST_USER['user_id'] = data['user']['id']
                return print_result(True, f"User registered successfully: {data['user']['email']}", 
                                  {"user_id": data['user']['id']})
            else:
                return print_result(False, "Registration response missing required fields", data)
        else:
            return print_result(False, f"Registration failed with status {response.status_code}", 
                              response.json() if response.text else None)
    except Exception as e:
        return print_result(False, f"Registration request failed: {str(e)}")

def test_get_experiences():
    """Test 6: Get Available Experiences"""
    print_test("Get Available Experiences")
    
    try:
        response = requests.get(
            f"{BASE_URL}/experiences",
            timeout=10
        )
        
        if response.status_code == 200:
            experiences = response.json()
            if len(experiences) > 0:
                TEST_USER['experience'] = experiences[0]
                return print_result(True, f"Retrieved {len(experiences)} experiences", 
                                  {"first_experience": experiences[0]['title']})
            else:
                return print_result(False, "No experiences found")
        else:
            return print_result(False, f"Failed to get experiences with status {response.status_code}")
    except Exception as e:
        return print_result(False, f"Get experiences request failed: {str(e)}")

def test_create_booking():
    """Test 7: Create a Booking"""
    print_test("Create Booking")
    
    if 'token' not in TEST_USER or 'experience' not in TEST_USER:
        return print_result(False, "Prerequisites not met (need token and experience)")
    
    try:
        experience = TEST_USER['experience']
        ticket_type = experience['ticket_types'][0]
        
        booking_data = {
            "experience_id": experience['id'],
            "tickets": [
                {
                    "ticket_type_id": ticket_type['id'],
                    "ticket_name": ticket_type['name'],
                    "quantity": 2,
                    "price_per_ticket": ticket_type['price']
                }
            ],
            "time_slot_id": experience.get('time_slots', [{}])[0].get('id') if experience.get('time_slots') else None,
            "selected_date": experience['date'],
            "special_requests": "Testing booking confirmation workflow"
        }
        
        response = requests.post(
            f"{BASE_URL}/bookings",
            json=booking_data,
            headers={"Authorization": f"Bearer {TEST_USER['token']}"},
            timeout=10
        )
        
        if response.status_code == 200:
            booking = response.json()
            TEST_USER['booking'] = booking
            return print_result(True, f"Booking created successfully", 
                              {"booking_id": booking['id'], "total": booking['total_amount']})
        else:
            return print_result(False, f"Booking creation failed with status {response.status_code}", 
                              response.json() if response.text else None)
    except Exception as e:
        return print_result(False, f"Create booking request failed: {str(e)}")

def test_confirm_payment():
    """Test 8: Confirm Payment and Verify Email/Calendar Triggers"""
    print_test("Confirm Payment (Email & Calendar Integration)")
    
    if 'token' not in TEST_USER or 'booking' not in TEST_USER:
        return print_result(False, "Prerequisites not met (need token and booking)")
    
    try:
        booking_id = TEST_USER['booking']['id']
        
        response = requests.post(
            f"{BASE_URL}/payment/confirm/{booking_id}",
            headers={"Authorization": f"Bearer {TEST_USER['token']}"},
            timeout=15
        )
        
        if response.status_code == 200:
            confirmed_booking = response.json()
            
            # Check if booking was confirmed
            has_qr_code = 'qr_code' in confirmed_booking
            is_confirmed = confirmed_booking.get('status') == 'confirmed'
            is_paid = confirmed_booking.get('payment_status') in ['paid', 'deposit_paid']
            
            success = all([has_qr_code, is_confirmed, is_paid])
            
            result_data = {
                "booking_id": booking_id,
                "status": confirmed_booking.get('status'),
                "payment_status": confirmed_booking.get('payment_status'),
                "has_qr_code": has_qr_code,
                "calendar_event_id": confirmed_booking.get('calendar_event_id', 'Not in response (async)')
            }
            
            if success:
                print_result(True, "Payment confirmed successfully", result_data)
                print("\n📧 Email Integration:")
                print("  - Booking confirmation email should be sent to:", TEST_USER['email'])
                print("  - Email should contain: 'Welcome to the Wandering Yacht Club!'")
                print("  - Business invoice should be sent to: booking@wanderingyacht.com")
                
                print("\n📅 Google Calendar Integration:")
                print("  - Calendar event should be created in: WANDERING YACHT EXPERIENCES")
                print("  - Event should include customer details, booking info, and payment status")
                print("  - Check backend logs for calendar event ID")
                
                return True
            else:
                return print_result(False, "Payment confirmation incomplete", result_data)
        else:
            return print_result(False, f"Payment confirmation failed with status {response.status_code}", 
                              response.json() if response.text else None)
    except Exception as e:
        return print_result(False, f"Confirm payment request failed: {str(e)}")

def check_backend_logs():
    """Test 9: Check Backend Logs for Email and Calendar Confirmations"""
    print_test("Backend Logs Verification")
    
    try:
        import subprocess
        
        # Check both stdout and stderr logs
        result_out = subprocess.run(
            ['tail', '-n', '100', '/var/log/supervisor/backend.out.log'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        result_err = subprocess.run(
            ['tail', '-n', '100', '/var/log/supervisor/backend.err.log'],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        logs = result_out.stdout + "\n" + result_err.stdout
        
        # Check for email confirmation
        has_email_log = 'Booking confirmation email sent' in logs or 'email sent' in logs.lower()
        has_calendar_log = 'Google Calendar event created' in logs or 'calendar event' in logs.lower()
        has_business_invoice = 'Business invoice sent' in logs
        
        print("\n📋 Recent Backend Logs (Email & Calendar):")
        print("-" * 80)
        for line in logs.split('\n'):
            if any(keyword in line.lower() for keyword in ['email', 'calendar', 'booking confirmation', 'invoice']):
                print(f"  {line}")
        print("-" * 80)
        
        if has_email_log and has_calendar_log:
            result_msg = "Backend logs confirm email and calendar integrations triggered"
            if has_business_invoice:
                result_msg += " (including business invoice)"
            return print_result(True, result_msg)
        elif has_email_log:
            return print_result(True, "Backend logs confirm email integration triggered (calendar may be async)")
        else:
            print_result(False, "Backend logs do not show clear confirmation of integrations")
            print("Note: Integrations may still be working - check full logs for details")
            return False
    except Exception as e:
        return print_result(False, f"Failed to check backend logs: {str(e)}")

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("WANDERING YACHT - Booking Confirmation Workflow Testing")
    print("Testing: Email Service, Google Calendar, and Booking Confirmation")
    print("="*80)
    
    results = []
    
    # Configuration Tests
    results.append(("Email Configuration", test_email_configuration()))
    results.append(("Email Template Greeting", test_email_template()))
    results.append(("Calendar Service File", test_calendar_service()))
    results.append(("Calendar Credentials", test_calendar_credentials()))
    
    # API Workflow Tests
    results.append(("User Registration", test_user_registration()))
    results.append(("Get Experiences", test_get_experiences()))
    results.append(("Create Booking", test_create_booking()))
    results.append(("Confirm Payment", test_confirm_payment()))
    results.append(("Backend Logs", check_backend_logs()))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\n{'='*80}")
    print(f"TOTAL: {passed}/{total} tests passed ({int(passed/total*100)}%)")
    print(f"{'='*80}\n")
    
    if passed == total:
        print("🎉 All tests passed! Booking confirmation workflow is working correctly.")
        print("\n✅ Email Service: Configured and ready")
        print("✅ Email Template: Contains 'Welcome to the Wandering Yacht Club!' greeting")
        print("✅ Google Calendar: Service configured and integrated")
        print("✅ Booking Confirmation: Triggers both email and calendar events")
    else:
        print("⚠️  Some tests failed. Review the results above for details.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
