from flask import Blueprint, request, jsonify, current_app
import re
from bson import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import datetime

customer_bp = Blueprint('customer_bp', __name__)

def validate_signup_data(data):
    errors = []
    
    # Required fields
    required_fields = ['firstName', 'lastName', 'email', 'phone', 'password', 'address']
    for field in required_fields:
        if not data.get(field):
            errors.append(f"{field} is required")
    
    # Email validation
    if data.get('email'):
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, data['email']):
            errors.append("Invalid email format")
    
    # Phone validation
    if data.get('phone'):
        if not re.match(r'^\d{10}$', data['phone']):
            errors.append("Phone number must be 10 digits")
    
    # Password validation
    if data.get('password'):
        if len(data['password']) < 6:
            errors.append("Password must be at least 6 characters long")
    
    return errors

def generate_username(email, first_name, last_name):
    """Generate a username from email and names - matching seller routes"""
    # Option 1: Use email prefix
    username_base = email.split('@')[0].lower()
    
    # Option 2: Alternative - use first name + last initial
    # username_base = f"{first_name.lower()}{last_name[0].lower()}" if first_name and last_name else email.split('@')[0].lower()
    
    return username_base

def generate_token(customer_id):
    """Generate JWT token for authentication"""
    try:
        payload = {
            'customer_id': str(customer_id),
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=30),
            'iat': datetime.datetime.utcnow()
        }
        # Replace 'your-secret-key' with a proper secret key from environment variables
        secret_key = current_app.config.get('SECRET_KEY', 'your-secret-key')
        return jwt.encode(payload, secret_key, algorithm='HS256')
    except Exception as e:
        return None

@customer_bp.route('/signup', methods=['POST'])
def signup():
    try:
        data = request.json
        
        # Validate input data
        validation_errors = validate_signup_data(data)
        if validation_errors:
            return jsonify({
                "error": "Validation failed", 
                "details": validation_errors
            }), 400
        
        db = current_app.mongo.db
        
        # Check if email already exists
        if db.customers.find_one({"email": data["email"]}):
            return jsonify({
                "error": "Email already exists"
            }), 400
        
        # Generate username if not provided - matching seller routes
        if not data.get('username'):
            data['username'] = generate_username(data['email'], data.get('firstName', ''), data.get('lastName', ''))
        
        # Hash the password before storing
        if 'password' in data:
            data['password'] = generate_password_hash(data['password'])
        
        # Remove confirmPassword from data before saving
        if 'confirmPassword' in data:
            del data['confirmPassword']
        
        # Insert customer data
        result = db.customers.insert_one(data)
        
        # Generate token
        token = generate_token(result.inserted_id)
        
        # Get the created customer (excluding password) - matching seller routes structure
        customer = db.customers.find_one({"_id": result.inserted_id})
        customer_data = {
            "_id": str(customer["_id"]),
            "id": str(customer["_id"]),  # Add id field for consistency
            "email": customer["email"],
            "firstName": customer.get("firstName"),
            "lastName": customer.get("lastName"),
            "username": customer.get("username", customer["email"].split('@')[0]),  # Add username
            "phone": customer.get("phone"),
            "address": customer.get("address"),
            "userType": "customer"
        }
        
        return jsonify({
            "success": True,
            "message": "Customer account created successfully",
            "customerId": str(result.inserted_id),
            "customer": customer_data,
            "user": customer_data,  # Add user field for consistency with frontend
            "token": token
        }), 201
        
    except Exception as e:
        return jsonify({
            "error": "Internal server error"
        }), 500

@customer_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.json
        
        if not data.get('email') or not data.get('password'):
            return jsonify({
                "error": "Email and password are required"
            }), 400
        
        db = current_app.mongo.db
        customer = db.customers.find_one({"email": data["email"]})
        
        if not customer:
            return jsonify({
                "error": "Invalid email or password"
            }), 401
        
        # Check password using werkzeug's check_password_hash
        if not check_password_hash(customer["password"], data["password"]):
            return jsonify({
                "error": "Invalid email or password"
            }), 401
        
        # Generate token
        token = generate_token(customer["_id"])
        
        # Remove password from response - matching seller routes structure
        customer_data = {
            "_id": str(customer["_id"]),
            "id": str(customer["_id"]),  # Add id field for consistency
            "email": customer["email"],
            "firstName": customer.get("firstName"),
            "lastName": customer.get("lastName"),
            "username": customer.get("username", customer["email"].split('@')[0]),  # Add username
            "phone": customer.get("phone"),
            "address": customer.get("address"),
            "userType": "customer"
        }
        
        return jsonify({
            "success": True,
            "message": "Login successful", 
            "customer": customer_data,
            "user": customer_data,  # Add user field for consistency with frontend
            "token": token
        }), 200
        
    except Exception as e:
        return jsonify({
            "error": "Internal server error"
        }), 500

@customer_bp.route('/profile/<customer_id>', methods=['GET'])
def get_customer_profile(customer_id):
    try:
        db = current_app.mongo.db
        
        # Validate ObjectId
        try:
            obj_id = ObjectId(customer_id)
        except:
            return jsonify({
                "error": "Invalid customer ID"
            }), 400
        
        # Find customer by ID
        customer = db.customers.find_one({"_id": obj_id})
        
        if not customer:
            return jsonify({
                "error": "Customer not found"
            }), 404
        
        # Remove sensitive information - matching seller routes structure
        customer_data = {
            "_id": str(customer["_id"]),
            "id": str(customer["_id"]),
            "email": customer["email"],
            "firstName": customer.get("firstName"),
            "lastName": customer.get("lastName"),
            "username": customer.get("username", customer["email"].split('@')[0]),
            "phone": customer.get("phone"),
            "address": customer.get("address"),
            "userType": "customer"
        }
        
        return jsonify({
            "success": True,
            "customer": customer_data
        }), 200
        
    except Exception as e:
        return jsonify({
            "error": "Internal server error"
        }), 500

@customer_bp.route('/profile/<customer_id>', methods=['PUT'])
def update_customer_profile(customer_id):
    try:
        data = request.json
        db = current_app.mongo.db
        
        # Validate ObjectId
        try:
            obj_id = ObjectId(customer_id)
        except:
            return jsonify({
                "error": "Invalid customer ID"
            }), 400
        
        # Check if customer exists
        customer = db.customers.find_one({"_id": obj_id})
        if not customer:
            return jsonify({
                "error": "Customer not found"
            }), 404
        
        # Remove fields that shouldn't be updated directly
        update_data = {k: v for k, v in data.items() if k not in ['_id', 'password', 'confirmPassword']}
        
        # Validate email if being updated
        if 'email' in update_data and update_data['email'] != customer['email']:
            # Check if new email already exists
            if db.customers.find_one({"email": update_data['email'], "_id": {"$ne": obj_id}}):
                return jsonify({
                    "error": "Email already exists"
                }), 400
            
            # Validate email format
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, update_data['email']):
                return jsonify({
                    "error": "Invalid email format"
                }), 400
        
        # Validate phone if being updated
        if 'phone' in update_data:
            if not re.match(r'^\d{10}$', update_data['phone']):
                return jsonify({
                    "error": "Phone number must be 10 digits"
                }), 400
        
        # Update customer
        db.customers.update_one({"_id": obj_id}, {"$set": update_data})
        
        # Get updated customer data - matching seller routes structure
        updated_customer = db.customers.find_one({"_id": obj_id})
        
        customer_data = {
            "_id": str(updated_customer["_id"]),
            "id": str(updated_customer["_id"]),
            "email": updated_customer["email"],
            "firstName": updated_customer.get("firstName"),
            "lastName": updated_customer.get("lastName"),
            "username": updated_customer.get("username", updated_customer["email"].split('@')[0]),
            "phone": updated_customer.get("phone"),
            "address": updated_customer.get("address"),
            "userType": "customer"
        }
        
        return jsonify({
            "success": True,
            "message": "Profile updated successfully",
            "customer": customer_data
        }), 200
        
    except Exception as e:
        return jsonify({
            "error": "Internal server error"
        }), 500

@customer_bp.route('/change-password/<customer_id>', methods=['PUT'])
def change_password(customer_id):
    try:
        data = request.json
        db = current_app.mongo.db
        
        # Validate required fields
        required_fields = ['currentPassword', 'newPassword']
        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    "error": f"{field} is required"
                }), 400
        
        # Validate ObjectId
        try:
            obj_id = ObjectId(customer_id)
        except:
            return jsonify({
                "error": "Invalid customer ID"
            }), 400
        
        # Find customer
        customer = db.customers.find_one({"_id": obj_id})
        if not customer:
            return jsonify({
                "error": "Customer not found"
            }), 404
        
        # Verify current password
        if not check_password_hash(customer["password"], data["currentPassword"]):
            return jsonify({
                "error": "Current password is incorrect"
            }), 400
        
        # Validate new password
        if len(data["newPassword"]) < 6:
            return jsonify({
                "error": "New password must be at least 6 characters long"
            }), 400
        
        # Check if new password is different from current
        if check_password_hash(customer["password"], data["newPassword"]):
            return jsonify({
                "error": "New password must be different from current password"
            }), 400
        
        # Hash new password
        new_password_hash = generate_password_hash(data["newPassword"])
        
        # Update password
        db.customers.update_one(
            {"_id": obj_id},
            {"$set": {"password": new_password_hash}}
        )
        
        return jsonify({
            "success": True,
            "message": "Password changed successfully"
        }), 200
        
    except Exception as e:
        print(f"Password change error: {e}")
        return jsonify({
            "error": "Internal server error"
        }), 500

@customer_bp.route('/stats/<customer_id>', methods=['GET'])
def get_customer_stats(customer_id):
    """Get customer statistics - similar to seller stats"""
    try:
        db = current_app.mongo.db
        
        # Validate ObjectId
        try:
            obj_id = ObjectId(customer_id)
        except:
            return jsonify({
                "error": "Invalid customer ID"
            }), 400
        
        # Check if customer exists
        customer = db.customers.find_one({"_id": obj_id})
        if not customer:
            return jsonify({
                "error": "Customer not found"
            }), 404
        
        # Get customer statistics (assuming you have orders collection with customerId field)
        total_orders = db.orders.count_documents({"customerId": customer_id})
        completed_orders = db.orders.count_documents({"customerId": customer_id, "status": "completed"})
        pending_orders = db.orders.count_documents({"customerId": customer_id, "status": "pending"})
        
        # You can add more statistics as needed
        stats = {
            "totalOrders": total_orders,
            "completedOrders": completed_orders,
            "pendingOrders": pending_orders,
            "cancelledOrders": total_orders - completed_orders - pending_orders
        }
        
        return jsonify({
            "success": True,
            "stats": stats
        }), 200
        
    except Exception as e:
        return jsonify({
            "error": "Internal server error"
        }), 500

@customer_bp.route('/delete-account/<customer_id>', methods=['DELETE'])
def delete_customer_account(customer_id):
    """Permanently delete customer account and all associated data"""
    try:
        data = request.json
        db = current_app.mongo.db
        
        # Validate ObjectId
        try:
            obj_id = ObjectId(customer_id)
        except:
            return jsonify({
                "error": "Invalid customer ID"
            }), 400
        
        # Check if customer exists
        customer = db.customers.find_one({"_id": obj_id})
        if not customer:
            return jsonify({
                "error": "Customer not found"
            }), 404
        
        # Optional: Verify password for security
        if data.get('password'):
            if not check_password_hash(customer["password"], data["password"]):
                return jsonify({
                    "error": "Password verification failed"
                }), 401
        
        # Start deletion process
        deletion_results = {}
        
        # 1. Delete all customer orders
        orders_result = db.orders.delete_many({"customerId": customer_id})
        deletion_results['orders_deleted'] = orders_result.deleted_count
        
        # 2. Delete customer account
        customer_result = db.customers.delete_one({"_id": obj_id})
        deletion_results['customer_deleted'] = customer_result.deleted_count
        
        # 3. Optional: Clean up any other related data (favorites, reviews, etc.)
        # Add more cleanup operations as needed based on your data model
        
        if customer_result.deleted_count > 0:
            return jsonify({
                "success": True,
                "message": "Account deleted permanently",
                "details": deletion_results
            }), 200
        else:
            return jsonify({
                "error": "Failed to delete account"
            }), 500
            
    except Exception as e:
        print(f"Error deleting customer account: {e}")
        return jsonify({
            "error": "Internal server error"
        }), 500

# Add middleware to verify JWT tokens
def verify_token(token):
    """Verify JWT token"""
    try:
        secret_key = current_app.config.get('SECRET_KEY', 'your-secret-key')
        payload = jwt.decode(token, secret_key, algorithms=['HS256'])
        return payload['customer_id']
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None