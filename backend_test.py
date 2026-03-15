#!/usr/bin/env python3
"""
WANDERING YACHT Backend API Test Suite
Tests all backend APIs including authentication, booking flow, and payment integration
"""

import requests
import json
import sys
import os
from datetime import datetime

# Base URL from frontend environment
BASE_URL = "https://wandering-yacht.preview.emergentagent.com/api"

class WanderingYachtTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.auth_token = None
        self.test_user_email = "marina.yacht@example.com"
        self.test_user_password = "SecurePass123!"
        self.test_user_name = "Marina Yacht Enthusiast"
        self.experience_id = None
        self.ticket_type_id = None
        self.booking_id = None
        self.results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "message": message,
            "details": details or {}
        }
        self.results.append(result)
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def test_health_check(self):
        """Test 1: Health Check"""
        try:
            response = self.session.get(f"{self.base_url}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_result("Health Check", True, "API is healthy")
                    return True
                else:
                    self.log_result("Health Check", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_result("Health Check", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Health Check", False, f"Connection error: {str(e)}")
            return False
    
    def test_categories(self):
        """Test 2: Categories API"""
        try:
            response = self.session.get(f"{self.base_url}/categories", timeout=10)
            if response.status_code == 200:
                categories = response.json()
                if len(categories) == 4:
                    category_names = [cat["name"] for cat in categories]
                    expected = ["Experiences", "Boat Rental", "Yacht Charter", "Management"]
                    if all(name in category_names for name in expected):
                        self.log_result("Categories API", True, f"Found all 4 categories: {category_names}")
                        return True
                    else:
                        self.log_result("Categories API", False, f"Missing categories. Found: {category_names}")
                        return False
                else:
                    self.log_result("Categories API", False, f"Expected 4 categories, got {len(categories)}")
                    return False
            else:
                self.log_result("Categories API", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Categories API", False, f"Error: {str(e)}")
            return False
    
    def test_experiences(self):
        """Test 3: Experiences API"""
        try:
            response = self.session.get(f"{self.base_url}/experiences", timeout=10)
            if response.status_code == 200:
                experiences = response.json()
                if len(experiences) >= 7:
                    # Store first experience for booking test
                    self.experience_id = experiences[0]["id"]
                    if experiences[0].get("ticket_types"):
                        self.ticket_type_id = experiences[0]["ticket_types"][0]["id"]
                    
                    self.log_result("Experiences API", True, f"Found {len(experiences)} experiences, stored experience_id: {self.experience_id}")
                    return True
                else:
                    self.log_result("Experiences API", False, f"Expected at least 7 experiences, got {len(experiences)}")
                    return False
            else:
                self.log_result("Experiences API", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Experiences API", False, f"Error: {str(e)}")
            return False
    
    def test_user_registration(self):
        """Test 4: User Registration"""
        try:
            # First try to register a new user
            user_data = {
                "email": self.test_user_email,
                "password": self.test_user_password,
                "full_name": self.test_user_name
            }
            
            response = self.session.post(f"{self.base_url}/auth/register", 
                                       json=user_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.auth_token = data["access_token"]
                    self.log_result("User Registration", True, f"User registered successfully: {data['user']['email']}")
                    return True
                else:
                    self.log_result("User Registration", False, f"Missing token or user in response: {data}")
                    return False
            elif response.status_code == 400 and "already registered" in response.text:
                # User already exists, that's fine for testing
                self.log_result("User Registration", True, "User already exists (expected for repeated tests)")
                return True
            else:
                self.log_result("User Registration", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("User Registration", False, f"Error: {str(e)}")
            return False
    
    def test_user_login(self):
        """Test 5: User Login"""
        try:
            login_data = {
                "email": self.test_user_email,
                "password": self.test_user_password
            }
            
            response = self.session.post(f"{self.base_url}/auth/login", 
                                       json=login_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.auth_token = data["access_token"]
                    self.log_result("User Login", True, f"Login successful for: {data['user']['email']}")
                    return True
                else:
                    self.log_result("User Login", False, f"Missing token or user in response: {data}")
                    return False
            else:
                self.log_result("User Login", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("User Login", False, f"Error: {str(e)}")
            return False
    
    def test_get_user_info(self):
        """Test 6: Get User Info (authenticated)"""
        if not self.auth_token:
            self.log_result("Get User Info", False, "No auth token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = self.session.get(f"{self.base_url}/auth/me", 
                                      headers=headers, timeout=10)
            
            if response.status_code == 200:
                user_data = response.json()
                if "email" in user_data and user_data["email"] == self.test_user_email:
                    self.log_result("Get User Info", True, f"Retrieved user info: {user_data['full_name']}")
                    return True
                else:
                    self.log_result("Get User Info", False, f"Unexpected user data: {user_data}")
                    return False
            else:
                self.log_result("Get User Info", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Get User Info", False, f"Error: {str(e)}")
            return False
    
    def test_create_booking(self):
        """Test 7: Create Booking (authenticated)"""
        if not self.auth_token or not self.experience_id or not self.ticket_type_id:
            self.log_result("Create Booking", False, "Missing auth token, experience_id, or ticket_type_id")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            booking_data = {
                "experience_id": self.experience_id,
                "tickets": [
                    {
                        "ticket_type_id": self.ticket_type_id,
                        "ticket_name": "Standard",
                        "quantity": 2,
                        "price_per_ticket": 150.0
                    }
                ]
            }
            
            response = self.session.post(f"{self.base_url}/bookings", 
                                       json=booking_data, headers=headers, timeout=10)
            
            if response.status_code == 200:
                booking = response.json()
                if "id" in booking and "total_amount" in booking:
                    self.booking_id = booking["id"]
                    expected_total = 2 * 150.0  # 2 tickets * $150 each
                    if booking["total_amount"] == expected_total:
                        self.log_result("Create Booking", True, f"Booking created: {self.booking_id}, Total: ${booking['total_amount']}")
                        return True
                    else:
                        self.log_result("Create Booking", False, f"Total calculation error. Expected: ${expected_total}, Got: ${booking['total_amount']}")
                        return False
                else:
                    self.log_result("Create Booking", False, f"Missing booking ID or total in response: {booking}")
                    return False
            else:
                self.log_result("Create Booking", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Create Booking", False, f"Error: {str(e)}")
            return False
    
    def test_get_user_bookings(self):
        """Test 8: Get User Bookings (authenticated)"""
        if not self.auth_token:
            self.log_result("Get User Bookings", False, "No auth token available")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = self.session.get(f"{self.base_url}/bookings", 
                                      headers=headers, timeout=10)
            
            if response.status_code == 200:
                bookings = response.json()
                if isinstance(bookings, list):
                    if self.booking_id:
                        # Check if our created booking is in the list
                        booking_ids = [b["id"] for b in bookings]
                        if self.booking_id in booking_ids:
                            self.log_result("Get User Bookings", True, f"Found {len(bookings)} bookings including our test booking")
                            return True
                        else:
                            self.log_result("Get User Bookings", False, f"Test booking {self.booking_id} not found in user bookings")
                            return False
                    else:
                        self.log_result("Get User Bookings", True, f"Retrieved {len(bookings)} user bookings")
                        return True
                else:
                    self.log_result("Get User Bookings", False, f"Expected list, got: {type(bookings)}")
                    return False
            else:
                self.log_result("Get User Bookings", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Get User Bookings", False, f"Error: {str(e)}")
            return False
    
    def test_create_payment_intent(self):
        """Test 9: Create Payment Intent (authenticated)"""
        if not self.auth_token or not self.booking_id:
            self.log_result("Create Payment Intent", False, "Missing auth token or booking_id")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            payment_data = {"booking_id": self.booking_id}
            
            response = self.session.post(f"{self.base_url}/payment/create-intent", 
                                       json=payment_data, headers=headers, timeout=10)
            
            if response.status_code == 200:
                payment_intent = response.json()
                required_fields = ["client_secret", "payment_intent_id", "amount", "publishable_key"]
                if all(field in payment_intent for field in required_fields):
                    # Verify amount is correct (300.00 * 100 = 30000 cents)
                    expected_amount = 30000  # $300 in cents
                    if payment_intent["amount"] == expected_amount:
                        self.log_result("Create Payment Intent", True, f"Payment intent created: {payment_intent['payment_intent_id']}, Amount: ${payment_intent['amount']/100}")
                        return True
                    else:
                        self.log_result("Create Payment Intent", False, f"Amount mismatch. Expected: {expected_amount}, Got: {payment_intent['amount']}")
                        return False
                else:
                    missing = [f for f in required_fields if f not in payment_intent]
                    self.log_result("Create Payment Intent", False, f"Missing fields: {missing}")
                    return False
            else:
                self.log_result("Create Payment Intent", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Create Payment Intent", False, f"Error: {str(e)}")
            return False
    
    def test_confirm_payment(self):
        """Test 10: Confirm Payment (authenticated)"""
        if not self.auth_token or not self.booking_id:
            self.log_result("Confirm Payment", False, "Missing auth token or booking_id")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = self.session.post(f"{self.base_url}/payment/confirm/{self.booking_id}", 
                                       headers=headers, timeout=10)
            
            if response.status_code == 200:
                confirmed_booking = response.json()
                if (confirmed_booking.get("status") == "confirmed" and 
                    confirmed_booking.get("payment_status") == "paid" and
                    confirmed_booking.get("qr_code")):
                    
                    # Verify QR code is base64 encoded image
                    qr_code = confirmed_booking["qr_code"]
                    if qr_code.startswith("data:image/png;base64,"):
                        self.log_result("Confirm Payment", True, f"Payment confirmed, QR code generated for booking: {self.booking_id}")
                        return True
                    else:
                        self.log_result("Confirm Payment", False, "QR code format invalid")
                        return False
                else:
                    missing = []
                    if confirmed_booking.get("status") != "confirmed":
                        missing.append("status not confirmed")
                    if confirmed_booking.get("payment_status") != "paid":
                        missing.append("payment_status not paid")
                    if not confirmed_booking.get("qr_code"):
                        missing.append("qr_code missing")
                    
                    self.log_result("Confirm Payment", False, f"Payment confirmation issues: {missing}")
                    return False
            else:
                self.log_result("Confirm Payment", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_result("Confirm Payment", False, f"Error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print(f"🚢 WANDERING YACHT Backend API Test Suite")
        print(f"Base URL: {self.base_url}")
        print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        
        # Run tests in order
        tests = [
            self.test_health_check,
            self.test_categories,
            self.test_experiences,
            self.test_user_registration,
            self.test_user_login,
            self.test_get_user_info,
            self.test_create_booking,
            self.test_get_user_bookings,
            self.test_create_payment_intent,
            self.test_confirm_payment
        ]
        
        passed = 0
        failed = 0
        
        for test in tests:
            try:
                if test():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ FAIL: {test.__name__} - Unexpected error: {str(e)}")
                failed += 1
            print()  # Add spacing between tests
        
        # Summary
        print("=" * 60)
        print(f"📊 TEST SUMMARY")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📈 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        if failed > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.results:
                if "❌ FAIL" in result["status"]:
                    print(f"   • {result['test']}: {result['message']}")
        
        return failed == 0

def main():
    """Main test runner"""
    tester = WanderingYachtTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed! Backend APIs are working correctly.")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Check the details above.")
        sys.exit(1)

if __name__ == "__main__":
    main()