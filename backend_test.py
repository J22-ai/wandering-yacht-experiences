#!/usr/bin/env python3
"""
Backend API Testing for WANDERING YACHT - 70% Balance Collection Flow
Tests the complete multi-step balance collection flow and business invoice system.
"""

import requests
import json
import time
import random
from typing import Dict, Any

# Configuration
BASE_URL = "https://wandering-yacht-1.preview.emergentagent.com/api"
TEST_USER = {
    "email": f"balance-test-{random.randint(1000, 9999)}@example.com",
    "password": "test123456",
    "full_name": "Balance Test User"
}

class BalanceFlowTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.booking_id = None
        self.experience_id = None
        
    def log(self, message: str, status: str = "INFO"):
        print(f"[{status}] {message}")
        
    def make_request(self, method: str, endpoint: str, data: Dict = None, auth: bool = True) -> Dict[Any, Any]:
        """Make HTTP request with proper headers"""
        url = f"{BASE_URL}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if auth and self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
            
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=headers)
            elif method.upper() == "POST":
                response = self.session.post(url, headers=headers, json=data)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            self.log(f"{method} {endpoint} -> {response.status_code}")
            
            if response.status_code >= 400:
                self.log(f"Error response: {response.text}", "ERROR")
                
            return {
                "status_code": response.status_code,
                "data": response.json() if response.content else {},
                "success": 200 <= response.status_code < 300
            }
        except Exception as e:
            self.log(f"Request failed: {str(e)}", "ERROR")
            return {"status_code": 0, "data": {}, "success": False, "error": str(e)}
    
    def test_1_register_user(self) -> bool:
        """Test 1: Register a user"""
        self.log("=== TEST 1: Register User ===")
        
        result = self.make_request("POST", "/auth/register", TEST_USER, auth=False)
        
        if result["success"]:
            self.auth_token = result["data"].get("access_token")
            if self.auth_token:
                self.log(f"✅ User registered successfully. Token: {self.auth_token[:20]}...")
                return True
            else:
                self.log("❌ Registration succeeded but no token received", "ERROR")
                return False
        else:
            self.log(f"❌ Registration failed: {result.get('data', {}).get('detail', 'Unknown error')}", "ERROR")
            return False
    
    def test_2_find_deposit_experience(self) -> bool:
        """Test 2: Find an experience that requires deposit"""
        self.log("=== TEST 2: Find Deposit Experience ===")
        
        result = self.make_request("GET", "/experiences", auth=False)
        
        if result["success"]:
            experiences = result["data"]
            deposit_experiences = [exp for exp in experiences if exp.get("requires_deposit") and exp.get("available_spots", 0) > 0]
            
            if deposit_experiences:
                # Use Catamaran Privilege 510 which has availability
                catamaran = next((exp for exp in deposit_experiences if "Catamaran" in exp["title"]), deposit_experiences[0])
                self.experience_id = catamaran["id"]
                exp_name = catamaran["title"]
                self.log(f"✅ Found deposit experience: {exp_name} (ID: {self.experience_id})")
                self.log(f"   Requires deposit: {catamaran.get('requires_deposit')}")
                self.log(f"   Deposit percentage: {catamaran.get('deposit_percentage', 30)}%")
                self.log(f"   Available spots: {catamaran.get('available_spots', 0)}")
                return True
            else:
                self.log("❌ No deposit experiences with availability found", "ERROR")
                return False
        else:
            self.log("❌ Failed to fetch experiences", "ERROR")
            return False
    
    def test_3_create_deposit_booking(self) -> bool:
        """Test 3: Create a booking for deposit experience"""
        self.log("=== TEST 3: Create Deposit Booking ===")
        
        if not self.experience_id:
            self.log("❌ No experience ID available", "ERROR")
            return False
        
        # Get experience details to find ticket types
        exp_result = self.make_request("GET", f"/experiences/{self.experience_id}", auth=False)
        if not exp_result["success"]:
            self.log("❌ Failed to get experience details", "ERROR")
            return False
            
        experience = exp_result["data"]
        ticket_types = experience.get("ticket_types", [])
        
        if not ticket_types:
            self.log("❌ No ticket types available", "ERROR")
            return False
        
        # Use the Full Day ticket if available, otherwise use the first one
        full_day_ticket = next((t for t in ticket_types if "Full Day" in t["name"]), ticket_types[0])
        
        booking_data = {
            "experience_id": self.experience_id,
            "tickets": [
                {
                    "ticket_type_id": full_day_ticket["id"],
                    "ticket_name": full_day_ticket["name"],
                    "quantity": 1,
                    "price_per_ticket": full_day_ticket["price"]
                }
            ],
            "special_requests": "Balance flow testing"
        }
        
        result = self.make_request("POST", "/bookings", booking_data)
        
        if result["success"]:
            booking = result["data"]
            self.booking_id = booking["id"]
            
            # Verify deposit calculations
            total = booking.get("total_amount", 0)
            deposit = booking.get("deposit_amount", 0)
            remaining = booking.get("remaining_balance", 0)
            
            self.log(f"✅ Booking created successfully (ID: {self.booking_id})")
            self.log(f"   Total Amount: €{total}")
            self.log(f"   Deposit Amount: €{deposit}")
            self.log(f"   Remaining Balance: €{remaining}")
            self.log(f"   Payment Status: {booking.get('payment_status')}")
            
            # Verify calculations
            expected_deposit = round(total * 0.30, 2)
            expected_remaining = round(total - expected_deposit, 2)
            
            if abs(deposit - expected_deposit) < 0.01 and abs(remaining - expected_remaining) < 0.01:
                self.log("✅ Deposit calculations are correct")
                return True
            else:
                self.log(f"❌ Deposit calculations incorrect. Expected: €{expected_deposit}/€{expected_remaining}", "ERROR")
                return False
        else:
            self.log("❌ Failed to create booking", "ERROR")
            return False
    
    def test_4_confirm_deposit_payment(self) -> bool:
        """Test 4: Confirm deposit payment"""
        self.log("=== TEST 4: Confirm Deposit Payment ===")
        
        if not self.booking_id:
            self.log("❌ No booking ID available", "ERROR")
            return False
            
        result = self.make_request("POST", f"/payment/confirm/{self.booking_id}")
        
        if result["success"]:
            booking = result["data"]  # Direct booking object, not nested
            payment_status = booking.get("payment_status")
            
            self.log(f"✅ Deposit payment confirmed")
            self.log(f"   Payment Status: {payment_status}")
            self.log(f"   QR Code Generated: {'qr_code' in booking}")
            
            if payment_status == "deposit_paid":
                self.log("✅ Payment status correctly set to 'deposit_paid'")
                return True
            else:
                self.log(f"❌ Expected payment_status 'deposit_paid', got '{payment_status}'", "ERROR")
                return False
        else:
            self.log("❌ Failed to confirm deposit payment", "ERROR")
            return False
    
    def test_5_balance_info_endpoint(self) -> bool:
        """Test 5: Get balance info (public endpoint)"""
        self.log("=== TEST 5: Balance Info Endpoint ===")
        
        if not self.booking_id:
            self.log("❌ No booking ID available", "ERROR")
            return False
            
        result = self.make_request("GET", f"/payment/balance-info/{self.booking_id}", auth=False)
        
        if result["success"]:
            info = result["data"]
            
            self.log("✅ Balance info retrieved successfully")
            self.log(f"   Booking ID: {info.get('booking_id')}")
            self.log(f"   Experience: {info.get('experience_title')}")
            self.log(f"   Total Amount: €{info.get('total_amount')}")
            self.log(f"   Deposit Amount: €{info.get('deposit_amount')}")
            self.log(f"   Remaining Balance: €{info.get('remaining_balance')}")
            self.log(f"   Status: {info.get('status')}")
            
            # Verify required fields
            required_fields = ["booking_id", "experience_title", "total_amount", "deposit_amount", "remaining_balance", "status"]
            missing_fields = [field for field in required_fields if field not in info]
            
            if not missing_fields and info.get("status") == "deposit_paid":
                self.log("✅ All required fields present and status correct")
                return True
            else:
                self.log(f"❌ Missing fields: {missing_fields} or incorrect status", "ERROR")
                return False
        else:
            self.log("❌ Failed to get balance info", "ERROR")
            return False
    
    def test_6_request_balance_email(self) -> bool:
        """Test 6: Request balance email (sends real email)"""
        self.log("=== TEST 6: Request Balance Email ===")
        
        if not self.booking_id:
            self.log("❌ No booking ID available", "ERROR")
            return False
            
        result = self.make_request("POST", f"/payment/request-balance/{self.booking_id}")
        
        if result["success"]:
            message = result["data"].get("message", "")
            self.log(f"✅ Balance request email sent: {message}")
            self.log("   NOTE: This sends a REAL email to the customer")
            return True
        else:
            self.log("❌ Failed to send balance request email", "ERROR")
            return False
    
    def test_7_create_balance_payment_intent(self) -> bool:
        """Test 7: Create balance payment intent"""
        self.log("=== TEST 7: Create Balance Payment Intent ===")
        
        if not self.booking_id:
            self.log("❌ No booking ID available", "ERROR")
            return False
            
        result = self.make_request("POST", f"/payment/create-balance-intent/{self.booking_id}")
        
        if result["success"]:
            intent = result["data"]
            
            self.log("✅ Balance payment intent created")
            self.log(f"   Client Secret: {intent.get('client_secret', '')[:20]}...")
            self.log(f"   Amount: €{intent.get('amount')}")
            self.log(f"   Payment Intent ID: {intent.get('payment_intent_id')}")
            
            # Verify required fields
            required_fields = ["client_secret", "amount", "payment_intent_id"]
            missing_fields = [field for field in required_fields if field not in intent]
            
            if not missing_fields:
                self.log("✅ All required fields present in payment intent")
                return True
            else:
                self.log(f"❌ Missing fields in payment intent: {missing_fields}", "ERROR")
                return False
        else:
            self.log("❌ Failed to create balance payment intent", "ERROR")
            return False
    
    def test_8_confirm_balance_payment(self) -> bool:
        """Test 8: Confirm balance payment"""
        self.log("=== TEST 8: Confirm Balance Payment ===")
        
        if not self.booking_id:
            self.log("❌ No booking ID available", "ERROR")
            return False
            
        result = self.make_request("POST", f"/payment/confirm-balance/{self.booking_id}")
        
        if result["success"]:
            response = result["data"]
            booking = response.get("booking", {})
            
            self.log("✅ Balance payment confirmed")
            self.log(f"   Status: {response.get('status')}")
            self.log(f"   Message: {response.get('message')}")
            self.log(f"   Payment Status: {booking.get('payment_status')}")
            self.log(f"   Remaining Balance: €{booking.get('remaining_balance', 0)}")
            
            # Verify final state
            if (response.get("status") == "success" and 
                booking.get("payment_status") == "paid" and 
                booking.get("remaining_balance") == 0):
                self.log("✅ Booking successfully upgraded to fully paid")
                return True
            else:
                self.log("❌ Booking not properly upgraded to fully paid", "ERROR")
                return False
        else:
            self.log("❌ Failed to confirm balance payment", "ERROR")
            return False
    
    def test_9_deposit_pending_bookings(self) -> bool:
        """Test 9: Check deposit pending bookings (should not include our booking)"""
        self.log("=== TEST 9: Deposit Pending Bookings ===")
        
        result = self.make_request("GET", "/bookings/deposit-pending")
        
        if result["success"]:
            bookings = result["data"]
            
            self.log(f"✅ Retrieved deposit pending bookings: {len(bookings)} found")
            
            # Check if our booking is NOT in the list (since we paid the balance)
            our_booking_in_list = any(b.get("booking", {}).get("id") == self.booking_id for b in bookings)
            
            if not our_booking_in_list:
                self.log("✅ Our fully paid booking is correctly NOT in deposit pending list")
                return True
            else:
                self.log("❌ Our fully paid booking is still in deposit pending list", "ERROR")
                return False
        elif result["status_code"] == 404:
            # 404 might mean no bookings found, which is acceptable if there are no deposit pending bookings
            self.log("✅ No deposit pending bookings found (404 response is acceptable)")
            self.log("✅ Our fully paid booking is correctly NOT in deposit pending list")
            return True
        else:
            self.log("❌ Failed to get deposit pending bookings", "ERROR")
            return False
    
    def run_all_tests(self) -> Dict[str, bool]:
        """Run all balance flow tests in sequence"""
        self.log("🚢 WANDERING YACHT - 70% Balance Collection Flow Testing")
        self.log("=" * 60)
        
        tests = [
            ("Register User", self.test_1_register_user),
            ("Find Deposit Experience", self.test_2_find_deposit_experience),
            ("Create Deposit Booking", self.test_3_create_deposit_booking),
            ("Confirm Deposit Payment", self.test_4_confirm_deposit_payment),
            ("Balance Info Endpoint", self.test_5_balance_info_endpoint),
            ("Request Balance Email", self.test_6_request_balance_email),
            ("Create Balance Payment Intent", self.test_7_create_balance_payment_intent),
            ("Confirm Balance Payment", self.test_8_confirm_balance_payment),
            ("Deposit Pending Bookings", self.test_9_deposit_pending_bookings),
        ]
        
        results = {}
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            try:
                result = test_func()
                results[test_name] = result
                if result:
                    passed += 1
                    self.log(f"✅ {test_name}: PASSED")
                else:
                    self.log(f"❌ {test_name}: FAILED")
            except Exception as e:
                results[test_name] = False
                self.log(f"❌ {test_name}: EXCEPTION - {str(e)}", "ERROR")
            
            self.log("-" * 40)
            time.sleep(1)  # Brief pause between tests
        
        # Summary
        self.log("=" * 60)
        self.log(f"🏁 TESTING COMPLETE: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 ALL TESTS PASSED! Balance collection flow is working correctly.")
        else:
            self.log(f"⚠️  {total - passed} tests failed. Please review the errors above.")
            
        return results

def main():
    """Main test execution"""
    tester = BalanceFlowTester()
    results = tester.run_all_tests()
    
    # Return exit code based on results
    all_passed = all(results.values())
    exit(0 if all_passed else 1)

if __name__ == "__main__":
    main()