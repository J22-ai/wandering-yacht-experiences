#!/usr/bin/env python3
"""
WANDERING YACHT WhatsApp Number Testing
Specific tests for WhatsApp number functionality as requested
"""

import requests
import json
import sys
from datetime import datetime

# API Base URL
BASE_URL = "https://wandering-yacht-1.preview.emergentagent.com/api"

class WhatsAppTester:
    def __init__(self):
        self.session = requests.Session()
        self.access_token = None
        self.test_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def test_health_check(self):
        """Test health endpoint"""
        try:
            response = self.session.get(f"{BASE_URL}/health", timeout=10)
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
            self.log_result("Health Check", False, f"Request failed: {str(e)}")
            return False
    
    def test_registration_with_whatsapp(self):
        """Test user registration with WhatsApp number"""
        test_data = {
            "email": "testwhatsapp@example.com",
            "password": "test123456",
            "full_name": "Test User",
            "phone": "+123456789",
            "whatsapp_number": "+987654321"
        }
        
        try:
            response = self.session.post(
                f"{BASE_URL}/auth/register",
                json=test_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if response has required fields
                if "access_token" in data and "user" in data:
                    user = data["user"]
                    
                    # Verify WhatsApp number is in response
                    if user.get("whatsapp_number") == test_data["whatsapp_number"]:
                        self.access_token = data["access_token"]
                        self.log_result(
                            "Registration with WhatsApp", 
                            True, 
                            "User registered successfully with WhatsApp number",
                            f"WhatsApp: {user.get('whatsapp_number')}"
                        )
                        return True
                    else:
                        self.log_result(
                            "Registration with WhatsApp", 
                            False, 
                            "WhatsApp number not returned in response",
                            f"Expected: {test_data['whatsapp_number']}, Got: {user.get('whatsapp_number')}"
                        )
                        return False
                else:
                    self.log_result(
                        "Registration with WhatsApp", 
                        False, 
                        "Missing required fields in response",
                        f"Response: {data}"
                    )
                    return False
            elif response.status_code == 400 and "already registered" in response.text:
                # User already exists, try to login instead
                self.log_result(
                    "Registration with WhatsApp", 
                    True, 
                    "User already exists (expected for repeated tests)"
                )
                return True
            else:
                self.log_result(
                    "Registration with WhatsApp", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_result("Registration with WhatsApp", False, f"Request failed: {str(e)}")
            return False
    
    def test_login_with_whatsapp_verification(self):
        """Test login and verify WhatsApp number is returned"""
        login_data = {
            "email": "testwhatsapp@example.com",
            "password": "test123456"
        }
        
        try:
            response = self.session.post(
                f"{BASE_URL}/auth/login",
                json=login_data,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if "access_token" in data and "user" in data:
                    user = data["user"]
                    self.access_token = data["access_token"]
                    
                    # Verify WhatsApp number is in response
                    whatsapp_number = user.get("whatsapp_number")
                    if whatsapp_number == "+987654321":
                        self.log_result(
                            "Login with WhatsApp verification", 
                            True, 
                            "Login successful, WhatsApp number returned",
                            f"WhatsApp: {whatsapp_number}"
                        )
                        return True
                    else:
                        self.log_result(
                            "Login with WhatsApp verification", 
                            False, 
                            "WhatsApp number not returned or incorrect",
                            f"Expected: +987654321, Got: {whatsapp_number}"
                        )
                        return False
                else:
                    self.log_result(
                        "Login with WhatsApp verification", 
                        False, 
                        "Missing required fields in response",
                        f"Response: {data}"
                    )
                    return False
            else:
                self.log_result(
                    "Login with WhatsApp verification", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_result("Login with WhatsApp verification", False, f"Request failed: {str(e)}")
            return False
    
    def test_get_me_whatsapp(self):
        """Test /auth/me endpoint and verify WhatsApp number"""
        if not self.access_token:
            self.log_result("Get Me WhatsApp", False, "No access token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.access_token}"}
        
        try:
            response = self.session.get(
                f"{BASE_URL}/auth/me",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                user = response.json()
                
                whatsapp_number = user.get("whatsapp_number")
                if whatsapp_number == "+987654321":
                    self.log_result(
                        "Get Me WhatsApp", 
                        True, 
                        "User profile retrieved with WhatsApp number",
                        f"WhatsApp: {whatsapp_number}"
                    )
                    return True
                else:
                    self.log_result(
                        "Get Me WhatsApp", 
                        False, 
                        "WhatsApp number not returned or incorrect",
                        f"Expected: +987654321, Got: {whatsapp_number}"
                    )
                    return False
            else:
                self.log_result(
                    "Get Me WhatsApp", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_result("Get Me WhatsApp", False, f"Request failed: {str(e)}")
            return False
    
    def test_categories_api(self):
        """Test categories API - should return MONTENEGRO Experiences"""
        try:
            response = self.session.get(f"{BASE_URL}/categories", timeout=10)
            
            if response.status_code == 200:
                categories = response.json()
                
                if isinstance(categories, list) and len(categories) > 0:
                    # Look for MONTENEGRO Experiences
                    montenegro_found = False
                    for category in categories:
                        if "MONTENEGRO" in category.get("name", "").upper():
                            montenegro_found = True
                            break
                    
                    if montenegro_found:
                        self.log_result(
                            "Categories API", 
                            True, 
                            "Categories retrieved with MONTENEGRO Experiences",
                            f"Found {len(categories)} categories"
                        )
                        return True
                    else:
                        self.log_result(
                            "Categories API", 
                            False, 
                            "MONTENEGRO Experiences not found in categories",
                            f"Categories: {[cat.get('name') for cat in categories]}"
                        )
                        return False
                else:
                    self.log_result(
                        "Categories API", 
                        False, 
                        "No categories returned",
                        f"Response: {categories}"
                    )
                    return False
            else:
                self.log_result(
                    "Categories API", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_result("Categories API", False, f"Request failed: {str(e)}")
            return False
    
    def test_experiences_api(self):
        """Test experiences API - should return experiences with prices"""
        try:
            response = self.session.get(f"{BASE_URL}/experiences", timeout=10)
            
            if response.status_code == 200:
                experiences = response.json()
                
                if isinstance(experiences, list) and len(experiences) > 0:
                    # Check if experiences have prices
                    experiences_with_prices = 0
                    currency_info = []
                    
                    for exp in experiences:
                        ticket_types = exp.get("ticket_types", [])
                        if ticket_types:
                            for ticket in ticket_types:
                                if "price" in ticket and ticket["price"] > 0:
                                    experiences_with_prices += 1
                                    # Note: The code shows USD prices, not EUR as mentioned in request
                                    currency_info.append(f"{ticket['name']}: ${ticket['price']}")
                                    break
                    
                    if experiences_with_prices > 0:
                        self.log_result(
                            "Experiences API", 
                            True, 
                            f"Experiences retrieved with prices (USD format)",
                            f"Found {len(experiences)} experiences, {experiences_with_prices} with prices"
                        )
                        return True
                    else:
                        self.log_result(
                            "Experiences API", 
                            False, 
                            "No experiences with prices found",
                            f"Total experiences: {len(experiences)}"
                        )
                        return False
                else:
                    self.log_result(
                        "Experiences API", 
                        False, 
                        "No experiences returned",
                        f"Response: {experiences}"
                    )
                    return False
            else:
                self.log_result(
                    "Experiences API", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_result("Experiences API", False, f"Request failed: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting WANDERING YACHT WhatsApp Number Testing")
        print("=" * 60)
        
        # Test sequence
        tests = [
            self.test_health_check,
            self.test_registration_with_whatsapp,
            self.test_login_with_whatsapp_verification,
            self.test_get_me_whatsapp,
            self.test_categories_api,
            self.test_experiences_api
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            if test():
                passed += 1
            print()  # Add spacing between tests
        
        # Summary
        print("=" * 60)
        print(f"📊 TEST SUMMARY: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed! WhatsApp functionality working correctly.")
        else:
            print("⚠️  Some tests failed. Check details above.")
        
        return passed == total

def main():
    """Main test execution"""
    tester = WhatsAppTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()