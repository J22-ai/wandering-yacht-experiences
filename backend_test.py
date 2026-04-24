#!/usr/bin/env python3
"""
Backend Test Suite for 30% Deposit Feature
Testing the yacht/boat charter booking deposit functionality
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://wandering-yacht-1.preview.emergentagent.com/api"
TEST_USER = {
    "email": "test@wanderingyacht.com",
    "password": "test123456",
    "full_name": "Test User"
}

class DepositFeatureTest:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, message: str, details: Any = None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details and not success:
            print(f"   Details: {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "details": details
        })
    
    def authenticate(self) -> bool:
        """Authenticate user and get token"""
        try:
            # Try to login first
            login_response = self.session.post(
                f"{BASE_URL}/auth/login",
                json={"email": TEST_USER["email"], "password": TEST_USER["password"]}
            )
            
            if login_response.status_code == 200:
                data = login_response.json()
                self.auth_token = data["access_token"]
                self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                self.log_test("Authentication", True, "Login successful")
                return True
            elif login_response.status_code == 401:
                # User doesn't exist, register
                register_response = self.session.post(
                    f"{BASE_URL}/auth/register",
                    json=TEST_USER
                )
                
                if register_response.status_code == 200:
                    data = register_response.json()
                    self.auth_token = data["access_token"]
                    self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
                    self.log_test("Authentication", True, "Registration and login successful")
                    return True
                else:
                    self.log_test("Authentication", False, f"Registration failed: {register_response.status_code}", register_response.text)
                    return False
            else:
                self.log_test("Authentication", False, f"Login failed: {login_response.status_code}", login_response.text)
                return False
                
        except Exception as e:
            self.log_test("Authentication", False, f"Authentication error: {str(e)}")
            return False
    
    def test_admin_setup_endpoint(self) -> bool:
        """Test the admin setup endpoint"""
        try:
            response = self.session.post(f"{BASE_URL}/admin/setup-deposit-charters")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Admin Setup", True, f"Setup successful: {data.get('message', 'OK')}")
                return True
            else:
                self.log_test("Admin Setup", False, f"Setup failed: {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_test("Admin Setup", False, f"Setup error: {str(e)}")
            return False
    
    def test_deposit_flagged_experiences(self) -> bool:
        """Test that specific experiences have deposit flags"""
        try:
            response = self.session.get(f"{BASE_URL}/experiences")
            
            if response.status_code != 200:
                self.log_test("Deposit Experiences", False, f"Failed to get experiences: {response.status_code}")
                return False
            
            experiences = response.json()
            
            # Expected deposit experiences
            expected_deposit_experiences = [
                "Speedboat Adventure",
                "Catamaran Privilege 510 Yacht Charter", 
                "Classic Heritage Sail",
                "24M Luxury Motor Yacht Charter"
            ]
            
            found_deposit_experiences = []
            catamaran_has_3200_ticket = False
            heritage_has_2900_and_4900 = False
            
            for exp in experiences:
                title = exp.get("title", "")
                requires_deposit = exp.get("requires_deposit", False)
                deposit_percentage = exp.get("deposit_percentage", 0)
                
                # Check if this is one of our expected deposit experiences
                for expected in expected_deposit_experiences:
                    if expected in title:
                        if requires_deposit and deposit_percentage == 30:
                            found_deposit_experiences.append(title)
                            
                            # Special checks for specific experiences
                            if "Catamaran Privilege 510" in title:
                                # Check for €3200 Full Day ticket
                                for ticket in exp.get("ticket_types", []):
                                    if "Full Day - 8 Hours" in ticket.get("name", "") and ticket.get("price") == 3200:
                                        catamaran_has_3200_ticket = True
                            
                            elif "Classic Heritage Sail" in title:
                                # Check for €2900 and €4900 Full Day Charter tickets
                                prices_found = []
                                for ticket in exp.get("ticket_types", []):
                                    if "Full Day Charter" in ticket.get("name", ""):
                                        prices_found.append(ticket.get("price"))
                                if 2900 in prices_found and 4900 in prices_found:
                                    heritage_has_2900_and_4900 = True
                        break
            
            # Check results
            all_found = len(found_deposit_experiences) == len(expected_deposit_experiences)
            
            if all_found and catamaran_has_3200_ticket and heritage_has_2900_and_4900:
                self.log_test("Deposit Experiences", True, f"All deposit experiences found with correct settings: {found_deposit_experiences}")
                return True
            else:
                missing = set(expected_deposit_experiences) - set([exp for exp in found_deposit_experiences])
                issues = []
                if missing:
                    issues.append(f"Missing: {list(missing)}")
                if not catamaran_has_3200_ticket:
                    issues.append("Catamaran missing €3200 Full Day ticket")
                if not heritage_has_2900_and_4900:
                    issues.append("Heritage Sail missing €2900/€4900 Full Day tickets")
                
                self.log_test("Deposit Experiences", False, f"Issues found: {'; '.join(issues)}")
                return False
                
        except Exception as e:
            self.log_test("Deposit Experiences", False, f"Error checking experiences: {str(e)}")
            return False
    
    def test_non_deposit_experiences(self) -> bool:
        """Test that non-deposit experiences don't have deposit flags"""
        try:
            response = self.session.get(f"{BASE_URL}/experiences")
            
            if response.status_code != 200:
                self.log_test("Non-Deposit Experiences", False, f"Failed to get experiences: {response.status_code}")
                return False
            
            experiences = response.json()
            
            # Check for Sunrise Yoga on Deck specifically
            sunrise_yoga_found = False
            sunrise_yoga_no_deposit = False
            
            for exp in experiences:
                title = exp.get("title", "")
                if "Sunrise Yoga on Deck" in title:
                    sunrise_yoga_found = True
                    requires_deposit = exp.get("requires_deposit", False)
                    if not requires_deposit:
                        sunrise_yoga_no_deposit = True
                    break
            
            if sunrise_yoga_found and sunrise_yoga_no_deposit:
                self.log_test("Non-Deposit Experiences", True, "Sunrise Yoga on Deck correctly has no deposit requirement")
                return True
            elif not sunrise_yoga_found:
                self.log_test("Non-Deposit Experiences", False, "Sunrise Yoga on Deck not found")
                return False
            else:
                self.log_test("Non-Deposit Experiences", False, "Sunrise Yoga on Deck incorrectly has deposit requirement")
                return False
                
        except Exception as e:
            self.log_test("Non-Deposit Experiences", False, f"Error checking non-deposit experiences: {str(e)}")
            return False
    
    def find_experience_and_ticket(self, experience_title: str, ticket_name: str = None) -> tuple:
        """Find experience and specific ticket"""
        try:
            response = self.session.get(f"{BASE_URL}/experiences")
            if response.status_code != 200:
                return None, None
            
            experiences = response.json()
            
            for exp in experiences:
                if experience_title in exp.get("title", ""):
                    if ticket_name:
                        for ticket in exp.get("ticket_types", []):
                            if ticket_name in ticket.get("name", ""):
                                return exp, ticket
                    else:
                        # Return first ticket if no specific ticket requested
                        tickets = exp.get("ticket_types", [])
                        if tickets:
                            return exp, tickets[0]
            
            return None, None
            
        except Exception as e:
            print(f"Error finding experience: {e}")
            return None, None
    
    def test_deposit_booking_creation(self) -> bool:
        """Test creating a booking for a deposit experience"""
        try:
            # Find Catamaran with Full Day - 8 Hours ticket (€3200)
            experience, ticket = self.find_experience_and_ticket("Catamaran Privilege 510", "Full Day - 8 Hours")
            
            if not experience or not ticket:
                self.log_test("Deposit Booking Creation", False, "Could not find Catamaran Full Day ticket")
                return False
            
            # Create booking
            booking_data = {
                "experience_id": experience["id"],
                "tickets": [{
                    "ticket_type_id": ticket["id"],
                    "ticket_name": ticket["name"],
                    "quantity": 1,
                    "price_per_ticket": ticket["price"]
                }]
            }
            
            response = self.session.post(f"{BASE_URL}/bookings", json=booking_data)
            
            if response.status_code != 200:
                self.log_test("Deposit Booking Creation", False, f"Booking creation failed: {response.status_code}", response.text)
                return False
            
            booking = response.json()
            
            # Verify deposit calculations
            expected_total = 3200
            expected_deposit = 960.0  # 30% of 3200
            expected_remaining = 2240.0  # 70% of 3200
            
            checks = [
                (booking.get("payment_type") == "deposit", "payment_type should be 'deposit'"),
                (booking.get("deposit_percentage") == 30, "deposit_percentage should be 30"),
                (booking.get("deposit_amount") == expected_deposit, f"deposit_amount should be {expected_deposit}"),
                (booking.get("remaining_balance") == expected_remaining, f"remaining_balance should be {expected_remaining}"),
                (booking.get("total_amount") == expected_total, f"total_amount should be {expected_total}")
            ]
            
            failed_checks = [check[1] for check in checks if not check[0]]
            
            if not failed_checks:
                self.log_test("Deposit Booking Creation", True, f"Deposit booking created correctly with €{expected_deposit} deposit")
                return True
            else:
                self.log_test("Deposit Booking Creation", False, f"Deposit calculations incorrect: {'; '.join(failed_checks)}", booking)
                return False
                
        except Exception as e:
            self.log_test("Deposit Booking Creation", False, f"Error creating deposit booking: {str(e)}")
            return False
    
    def test_non_deposit_booking_creation(self) -> bool:
        """Test creating a booking for a non-deposit experience"""
        try:
            # Find Sunrise Yoga on Deck
            experience, ticket = self.find_experience_and_ticket("Sunrise Yoga on Deck")
            
            if not experience or not ticket:
                self.log_test("Non-Deposit Booking Creation", False, "Could not find Sunrise Yoga experience")
                return False
            
            # Create booking
            booking_data = {
                "experience_id": experience["id"],
                "tickets": [{
                    "ticket_type_id": ticket["id"],
                    "ticket_name": ticket["name"],
                    "quantity": 1,
                    "price_per_ticket": ticket["price"]
                }]
            }
            
            response = self.session.post(f"{BASE_URL}/bookings", json=booking_data)
            
            if response.status_code != 200:
                self.log_test("Non-Deposit Booking Creation", False, f"Booking creation failed: {response.status_code}", response.text)
                return False
            
            booking = response.json()
            
            # Verify full payment
            checks = [
                (booking.get("payment_type") == "full", "payment_type should be 'full'"),
                (booking.get("deposit_amount") == 0, "deposit_amount should be 0"),
                (booking.get("remaining_balance") == 0, "remaining_balance should be 0")
            ]
            
            failed_checks = [check[1] for check in checks if not check[0]]
            
            if not failed_checks:
                self.log_test("Non-Deposit Booking Creation", True, "Non-deposit booking created correctly with full payment")
                return True
            else:
                self.log_test("Non-Deposit Booking Creation", False, f"Full payment calculations incorrect: {'; '.join(failed_checks)}", booking)
                return False
                
        except Exception as e:
            self.log_test("Non-Deposit Booking Creation", False, f"Error creating non-deposit booking: {str(e)}")
            return False
    
    def test_payment_confirmation_deposit(self) -> bool:
        """Test payment confirmation for deposit booking"""
        try:
            # Create a deposit booking first
            experience, ticket = self.find_experience_and_ticket("Catamaran Privilege 510", "Full Day - 8 Hours")
            
            if not experience or not ticket:
                self.log_test("Payment Confirmation Deposit", False, "Could not find Catamaran experience for payment test")
                return False
            
            # Create booking
            booking_data = {
                "experience_id": experience["id"],
                "tickets": [{
                    "ticket_type_id": ticket["id"],
                    "ticket_name": ticket["name"],
                    "quantity": 1,
                    "price_per_ticket": ticket["price"]
                }]
            }
            
            booking_response = self.session.post(f"{BASE_URL}/bookings", json=booking_data)
            if booking_response.status_code != 200:
                self.log_test("Payment Confirmation Deposit", False, "Could not create booking for payment test")
                return False
            
            booking = booking_response.json()
            booking_id = booking["id"]
            
            # Confirm payment
            confirm_response = self.session.post(f"{BASE_URL}/payment/confirm/{booking_id}")
            
            if confirm_response.status_code != 200:
                self.log_test("Payment Confirmation Deposit", False, f"Payment confirmation failed: {confirm_response.status_code}", confirm_response.text)
                return False
            
            confirmed_booking = confirm_response.json()
            
            # Check payment status
            if confirmed_booking.get("payment_status") == "deposit_paid":
                self.log_test("Payment Confirmation Deposit", True, "Payment status correctly set to 'deposit_paid'")
                return True
            else:
                self.log_test("Payment Confirmation Deposit", False, f"Payment status incorrect: {confirmed_booking.get('payment_status')}", confirmed_booking)
                return False
                
        except Exception as e:
            self.log_test("Payment Confirmation Deposit", False, f"Error testing payment confirmation: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all deposit feature tests"""
        print("🚢 Starting 30% Deposit Feature Tests")
        print("=" * 50)
        
        # Authenticate first
        if not self.authenticate():
            print("❌ Authentication failed - cannot continue tests")
            return False
        
        # Run admin setup
        self.test_admin_setup_endpoint()
        
        # Run all tests
        tests = [
            self.test_deposit_flagged_experiences,
            self.test_non_deposit_experiences,
            self.test_deposit_booking_creation,
            self.test_non_deposit_booking_creation,
            self.test_payment_confirmation_deposit
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            if test():
                passed += 1
        
        print("\n" + "=" * 50)
        print(f"🏁 Test Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("✅ All deposit feature tests PASSED!")
            return True
        else:
            print("❌ Some tests FAILED - see details above")
            return False

if __name__ == "__main__":
    tester = DepositFeatureTest()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)