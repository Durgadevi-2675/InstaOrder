from flask import Blueprint, request, jsonify, current_app
import re
from bson import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash

seller_bp = Blueprint('seller_bp', __name__)

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
    """Generate a username from email and names"""
    # Option 1: Use email prefix
    username_base = email.split('@')[0].lower()
    
    # Option 2: Alternative - use first name + last initial
    # username_base = f"{first_name.lower()}{last_name[0].lower()}" if first_name and last_name else email.split('@')[0].lower()
    
    return username_base

@seller_bp.route('/signup', methods=['POST'])
def signup():
    try:
        data = request.json
        
        # Validate input data
        validation_errors = validate_signup_data(data)
        if validation_errors:
            return jsonify({"error": "Validation failed", "details": validation_errors}), 400
        
        db = current_app.mongo.db
        
        # Check if email already exists
        if db.sellers.find_one({"email": data["email"]}):
            return jsonify({"error": "Email already exists"}), 400
        
        # Generate username if not provided
        if not data.get('username'):
            data['username'] = generate_username(data['email'], data.get('firstName', ''), data.get('lastName', ''))
        
        # Hash the password before storing
        if 'password' in data:
            data['password'] = generate_password_hash(data['password'])
        
        # Remove confirmPassword from data before saving
        if 'confirmPassword' in data:
            del data['confirmPassword']
        
        # Insert seller data
        result = db.sellers.insert_one(data)
        
        return jsonify({
            "success": True,
            "message": "Seller account created successfully",
            "sellerId": str(result.inserted_id)
        }), 201
        
    except Exception as e:
        return jsonify({"error": "Internal server error"}), 500

@seller_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.json
        
        if not data.get('email') or not data.get('password'):
            return jsonify({"error": "Email and password are required"}), 400
        
        db = current_app.mongo.db
        seller = db.sellers.find_one({"email": data["email"]})
        
        if not seller:
            return jsonify({"error": "Invalid email or password"}), 401
        
        # Check password using werkzeug's check_password_hash
        if not check_password_hash(seller["password"], data["password"]):
            return jsonify({"error": "Invalid email or password"}), 401
        
        # Remove password from response
        seller_data = {
            "_id": str(seller["_id"]),
            "id": str(seller["_id"]),  # Add id field for consistency
            "email": seller["email"],
            "firstName": seller.get("firstName"),
            "lastName": seller.get("lastName"),
            "username": seller.get("username", seller["email"].split('@')[0]),  # Add username
            "phone": seller.get("phone"),
            "address": seller.get("address"),
            "userType": "seller"
        }
        
        return jsonify({
            "success": True,
            "message": "Login successful", 
            "seller": seller_data,
            "user": seller_data  # Add user field for consistency with frontend
        }), 200
        
    except Exception as e:
        return jsonify({"error": "Internal server error"}), 500

@seller_bp.route('/profile/<seller_id>', methods=['GET'])
def get_seller_profile(seller_id):
    try:
        db = current_app.mongo.db
        
        # Validate ObjectId
        try:
            obj_id = ObjectId(seller_id)
        except:
            return jsonify({"error": "Invalid seller ID"}), 400
        
        # Find seller by ID
        seller = db.sellers.find_one({"_id": obj_id})
        
        if not seller:
            return jsonify({"error": "Seller not found"}), 404
        
        # Remove sensitive information
        seller_data = {
            "_id": str(seller["_id"]),
            "id": str(seller["_id"]),
            "email": seller["email"],
            "firstName": seller.get("firstName"),
            "lastName": seller.get("lastName"),
            "username": seller.get("username", seller["email"].split('@')[0]),
            "phone": seller.get("phone"),
            "address": seller.get("address"),
            "userType": "seller"
        }
        
        return jsonify({
            "success": True,
            "seller": seller_data
        }), 200
        
    except Exception as e:
        return jsonify({"error": "Internal server error"}), 500

@seller_bp.route('/profile/<seller_id>', methods=['PUT'])
def update_seller_profile(seller_id):
    try:
        data = request.json
        db = current_app.mongo.db
        
        # Validate ObjectId
        try:
            obj_id = ObjectId(seller_id)
        except:
            return jsonify({"error": "Invalid seller ID"}), 400
        
        # Check if seller exists
        seller = db.sellers.find_one({"_id": obj_id})
        if not seller:
            return jsonify({"error": "Seller not found"}), 404
        
        # Remove fields that shouldn't be updated directly
        update_data = {k: v for k, v in data.items() if k not in ['_id', 'password', 'confirmPassword']}
        
        # Validate email if being updated
        if 'email' in update_data and update_data['email'] != seller['email']:
            # Check if new email already exists
            if db.sellers.find_one({"email": update_data['email'], "_id": {"$ne": obj_id}}):
                return jsonify({"error": "Email already exists"}), 400
            
            # Validate email format
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, update_data['email']):
                return jsonify({"error": "Invalid email format"}), 400
        
        # Validate phone if being updated
        if 'phone' in update_data:
            if not re.match(r'^\d{10}$', update_data['phone']):
                return jsonify({"error": "Phone number must be 10 digits"}), 400
        
        # Update seller
        db.sellers.update_one({"_id": obj_id}, {"$set": update_data})
        
        # Get updated seller data
        updated_seller = db.sellers.find_one({"_id": obj_id})
        
        seller_data = {
            "_id": str(updated_seller["_id"]),
            "id": str(updated_seller["_id"]),
            "email": updated_seller["email"],
            "firstName": updated_seller.get("firstName"),
            "lastName": updated_seller.get("lastName"),
            "username": updated_seller.get("username", updated_seller["email"].split('@')[0]),
            "phone": updated_seller.get("phone"),
            "address": updated_seller.get("address"),
            "userType": "seller"
        }
        
        return jsonify({
            "success": True,
            "message": "Profile updated successfully",
            "seller": seller_data
        }), 200
        
    except Exception as e:
        return jsonify({"error": "Internal server error"}), 500

@seller_bp.route('/change-password/<seller_id>', methods=['PUT'])
def change_password(seller_id):
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
            obj_id = ObjectId(seller_id)
        except:
            return jsonify({
                "error": "Invalid seller ID"
            }), 400
        
        # Find seller
        seller = db.sellers.find_one({"_id": obj_id})
        if not seller:
            return jsonify({
                "error": "Seller not found"
            }), 404
        
        # Verify current password
        if not check_password_hash(seller["password"], data["currentPassword"]):
            return jsonify({
                "error": "Current password is incorrect"
            }), 400
        
        # Validate new password
        if len(data["newPassword"]) < 6:
            return jsonify({
                "error": "New password must be at least 6 characters long"
            }), 400
        
        # Check if new password is different from current
        if check_password_hash(seller["password"], data["newPassword"]):
            return jsonify({
                "error": "New password must be different from current password"
            }), 400
        
        # Hash new password
        new_password_hash = generate_password_hash(data["newPassword"])
        
        # Update password
        db.sellers.update_one(
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

@seller_bp.route('/stats/<seller_id>', methods=['GET'])
def get_seller_stats(seller_id):
    try:
        db = current_app.mongo.db
        
        # Validate ObjectId
        try:
            obj_id = ObjectId(seller_id)
        except:
            return jsonify({"error": "Invalid seller ID"}), 400
        
        # Check if seller exists
        seller = db.sellers.find_one({"_id": obj_id})
        if not seller:
            return jsonify({"error": "Seller not found"}), 404
        
        # Get seller statistics (assuming you have products collection with sellerId field)
        total_products = db.products.count_documents({"sellerId": seller_id})
        active_products = db.products.count_documents({"sellerId": seller_id, "status": "active"})
        
        # You can add more statistics as needed
        stats = {
            "totalProducts": total_products,
            "activeProducts": active_products,
            "inactiveProducts": total_products - active_products
        }
        
        return jsonify({
            "success": True,
            "stats": stats
        }), 200
        
    except Exception as e:
        return jsonify({"error": "Internal server error"}), 500

@seller_bp.route('/delete-account/<seller_id>', methods=['DELETE'])
def delete_seller_account(seller_id):
    """Permanently delete seller account and all associated data"""
    try:
        data = request.json
        db = current_app.mongo.db
        
        # Validate ObjectId
        try:
            obj_id = ObjectId(seller_id)
        except:
            return jsonify({
                "error": "Invalid seller ID"
            }), 400
        
        # Check if seller exists
        seller = db.sellers.find_one({"_id": obj_id})
        if not seller:
            return jsonify({
                "error": "Seller not found"
            }), 404
        
        # Optional: Verify password for security
        if data.get('password'):
            if not check_password_hash(seller["password"], data["password"]):
                return jsonify({
                    "error": "Password verification failed"
                }), 401
        
        # Start deletion process
        deletion_results = {}
        
        # 1. Delete all seller's products
        products_result = db.products.delete_many({"sellerId": seller_id})
        deletion_results['products_deleted'] = products_result.deleted_count
        
        # 2. Delete all orders related to seller's products
        orders_result = db.orders.delete_many({"sellerId": seller_id})
        deletion_results['orders_deleted'] = orders_result.deleted_count
        
        # 3. Delete seller account
        seller_result = db.sellers.delete_one({"_id": obj_id})
        deletion_results['seller_deleted'] = seller_result.deleted_count
        
        # 4. Optional: Clean up any other related data (reviews, analytics, etc.)
        # Add more cleanup operations as needed based on your data model
        
        if seller_result.deleted_count > 0:
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
        print(f"Error deleting seller account: {e}")
        return jsonify({
            "error": "Internal server error"
        }), 500