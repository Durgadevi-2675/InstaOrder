from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_pymongo import PyMongo
from flask_mail import Mail, Message
from werkzeug.security import generate_password_hash, check_password_hash
import re
import secrets
import os
from datetime import datetime, timedelta
from controllers.customer_routes import customer_bp
from controllers.seller_routes import seller_bp
from controllers.product_routes import product_bp
from controllers.order_routes import order_bp

# Google OAuth imports
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
import google.auth.exceptions

app = Flask(__name__)

# ============================================================================
# GOOGLE OAUTH CONFIGURATION
# ============================================================================
app.config['GOOGLE_CLIENT_ID'] = ''
app.config['GOOGLE_CLIENT_SECRET'] = '' # Optional

# Add CORS configuration for Google OAuth
app.config['CORS_ORIGINS'] = ['http://localhost:4200', 'http://127.0.0.1:4200']

# ============================================================================
# UPDATED CORS CONFIGURATION
# ============================================================================
CORS(app, origins=['http://localhost:4200', 'http://127.0.0.1:4200'], 
     supports_credentials=True, 
     allow_headers=['Content-Type', 'Authorization'])

app.config["MONGO_URI"] = "mongodb://localhost:27017/order"
app.config['SECRET_KEY'] = 'replace-with-your-secret-key'

# Email configuration - UPDATE WITH YOUR ACTUAL CREDENTIALS
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USE_SSL'] = False
app.config['MAIL_USERNAME'] = ''  # Your actual Gmail
app.config['MAIL_PASSWORD'] = ''  # Get this from Google
app.config['MAIL_DEFAULT_SENDER'] = ''  # Your actual Gmail

mongo = PyMongo(app)
mail = Mail(app)
app.mongo = mongo

def validate_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_phone(phone):
    return re.match(r'^\d{10}$', phone) is not None

# ============================================================================
# GOOGLE TOKEN VERIFICATION (optional but recommended)
# ============================================================================
def verify_google_token(token, client_id):
    """Verify Google ID token"""
    try:
        idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), client_id)
        return idinfo
    except google.auth.exceptions.GoogleAuthError:
        return None

@app.route('/api/auth/signup', methods=['POST'])
def signup():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['firstName', 'lastName', 'email', 'phone', 'password', 'userType']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate email format
        if not validate_email(data['email']):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Validate phone format
        if not validate_phone(data['phone']):
            return jsonify({'error': 'Phone number must be 10 digits'}), 400
        
        # Validate password length
        if len(data['password']) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        
        # Validate user type
        if data['userType'] not in ['customer', 'seller']:
            return jsonify({'error': 'Invalid user type'}), 400
        
        # Select collection based on user type
        if data['userType'] == 'customer':
            users_collection = mongo.db.customers
        else:
            users_collection = mongo.db.sellers
        
        # Check if user already exists in the respective collection
        existing_user = users_collection.find_one({'email': data['email'].lower()})
        
        if existing_user:
            return jsonify({'error': f'{data["userType"].capitalize()} with this email already exists'}), 409
        
        # Create user document
        user_data = {
            'firstName': data['firstName'],
            'lastName': data['lastName'],
            'email': data['email'].lower(),
            'phone': data['phone'],
            'password': generate_password_hash(data['password']),
            'isActive': True
        }
        
        # Add specific fields based on user type
        if data['userType'] == 'seller':
            # Add seller-specific fields
            if 'address' in data:
                user_data['address'] = data['address']
            if 'businessName' in data:
                user_data['businessName'] = data['businessName']
            if 'businessType' in data:
                user_data['businessType'] = data['businessType']
        elif data['userType'] == 'customer':
            # Add customer-specific fields
            if 'address' in data:
                user_data['address'] = data['address']
            if 'dateOfBirth' in data:
                user_data['dateOfBirth'] = data['dateOfBirth']
        
        # Insert user into appropriate collection
        result = users_collection.insert_one(user_data)
        
        if result.inserted_id:
            return jsonify({
                'message': f'{data["userType"].capitalize()} created successfully',
                'userId': str(result.inserted_id),
                'userType': data['userType']
            }), 201
        else:
            return jsonify({'error': f'Failed to create {data["userType"]}'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email and password are required'}), 400
        
        if not data.get('userType'):
            return jsonify({'error': 'User type is required'}), 400
        
        # Validate user type
        if data['userType'] not in ['customer', 'seller']:
            return jsonify({'error': 'Invalid user type'}), 400
        
        # Select collection based on user type
        if data['userType'] == 'customer':
            users_collection = mongo.db.customers
        else:
            users_collection = mongo.db.sellers
        
        # Find user in appropriate collection
        user = users_collection.find_one({'email': data['email'].lower()})
        
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Check password
        if not check_password_hash(user['password'], data['password']):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Check if user is active
        if not user.get('isActive', True):
            return jsonify({'error': 'Account is deactivated'}), 401
        
        # Return user data (excluding password)
        user_response = {
            'id': str(user['_id']),
            'firstName': user['firstName'],
            'lastName': user['lastName'],
            'email': user['email'],
            'phone': user['phone'],
            'userType': data['userType']
        }
        
        # Add user-type specific fields
        if data['userType'] == 'seller':
            if 'address' in user:
                user_response['address'] = user['address']
            if 'businessName' in user:
                user_response['businessName'] = user['businessName']
            if 'businessType' in user:
                user_response['businessType'] = user['businessType']
        elif data['userType'] == 'customer':
            if 'address' in user:
                user_response['address'] = user['address']
            if 'dateOfBirth' in user:
                user_response['dateOfBirth'] = user['dateOfBirth']
        
        return jsonify({
            'message': 'Login successful',
            'user': user_response
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Route to provide Google Client ID to frontend
@app.route('/api/auth/google-config', methods=['GET'])
def get_google_config():
    try:
        return jsonify({
            'googleClientId': app.config.get('GOOGLE_CLIENT_ID', '')
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================================
# ENHANCED GOOGLE AUTH ROUTE (replaces your existing google_auth function)
# ============================================================================
@app.route('/api/auth/google-auth', methods=['POST'])
def google_auth():
    try:
        data = request.get_json()
        print(f"Received Google auth request: {data}")
        
        # Validate required fields
        required_fields = ['email', 'userType']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate user type
        if data['userType'] not in ['customer', 'seller']:
            return jsonify({'error': 'Invalid user type'}), 400
        
        # Validate email format
        if not validate_email(data['email']):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Select collection based on user type
        if data['userType'] == 'customer':
            users_collection = mongo.db.customers
        else:
            users_collection = mongo.db.sellers
        
        # Check if user exists with this email
        existing_user = users_collection.find_one({'email': data['email'].lower()})
        
        if existing_user:
            # Update existing user with Google info if provided
            update_data = {}
            if data.get('googleId'):
                update_data['googleId'] = data['googleId']
            if data.get('picture'):
                update_data['picture'] = data['picture']
            
            if update_data:
                users_collection.update_one({'_id': existing_user['_id']}, {'$set': update_data})
            
            # Login existing user
            user_data = {
                'id': str(existing_user['_id']),
                'email': existing_user['email'],
                'firstName': existing_user.get('firstName', data.get('firstName', '')),
                'lastName': existing_user.get('lastName', data.get('lastName', '')),
                'phone': existing_user.get('phone', ''),
                'address': existing_user.get('address', ''),
                'userType': data['userType'],
                'picture': data.get('picture', existing_user.get('picture', ''))
            }
            
            # Add user-type specific fields
            if data['userType'] == 'seller':
                if 'businessName' in existing_user:
                    user_data['businessName'] = existing_user['businessName']
                if 'businessType' in existing_user:
                    user_data['businessType'] = existing_user['businessType']
            elif data['userType'] == 'customer':
                if 'dateOfBirth' in existing_user:
                    user_data['dateOfBirth'] = existing_user['dateOfBirth']
            
            return jsonify({
                'success': True,
                'message': 'Google login successful',
                'user': user_data,
                'isNewUser': False
            }), 200
        else:
            # Create new user
            user_document = {
                'firstName': data.get('firstName', ''),
                'lastName': data.get('lastName', ''),
                'email': data['email'].lower(),
                'googleId': data.get('googleId', ''),
                'phone': data.get('phone', ''),
                'address': data.get('address', ''),
                'picture': data.get('picture', ''),
                'password': generate_password_hash(data.get('googleId', data['email'])),  # Use googleId or email as password
                'isActive': True,
                'createdAt': datetime.utcnow()
            }
            
            result = users_collection.insert_one(user_document)
            
            user_data = {
                'id': str(result.inserted_id),
                'email': user_document['email'],
                'firstName': user_document['firstName'],
                'lastName': user_document['lastName'],
                'phone': user_document['phone'],
                'address': user_document['address'],
                'userType': data['userType'],
                'picture': user_document['picture']
            }
            
            return jsonify({
                'success': True,
                'message': 'Google signup successful',
                'user': user_data,
                'userId': str(result.inserted_id),
                'isNewUser': True
            }), 201
            
    except Exception as e:
        print(f"Google auth error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Internal server error', 'debug': str(e)}), 500

# ============================================================================
# DEBUG ROUTE TO TEST GOOGLE CONFIG
# ============================================================================
@app.route('/api/auth/google-debug', methods=['GET'])
def google_debug():
    try:
        return jsonify({
            'clientId': app.config.get('GOOGLE_CLIENT_ID', 'Not configured'),
            'corsOrigins': app.config.get('CORS_ORIGINS', []),
            'serverRunning': True,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    try:
        data = request.get_json()
        print(f"Received forgot password request: {data}")
        
        # Validate required fields
        if not data.get('email'):
            return jsonify({'error': 'Email is required'}), 400
        
        if not data.get('userType'):
            return jsonify({'error': 'User type is required'}), 400
        
        # Validate user type
        if data['userType'] not in ['customer', 'seller']:
            return jsonify({'error': 'Invalid user type'}), 400
        
        # Validate email format
        if not validate_email(data['email']):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Select collection based on user type
        if data['userType'] == 'customer':
            users_collection = mongo.db.customers
        else:
            users_collection = mongo.db.sellers
        
        # Find user in appropriate collection
        user = users_collection.find_one({'email': data['email'].lower()})
        
        if not user:
            print(f"User not found with email: {data['email']}")
            # For security, don't reveal if email exists or not
            return jsonify({
                'success': True,
                'message': 'If your email is registered, you will receive a password reset link shortly.'
            }), 200
        
        print(f"User found: {user['firstName']} {user['lastName']}")
        
        # Generate reset token
        reset_token = secrets.token_urlsafe(32)
        reset_expiry = datetime.utcnow() + timedelta(hours=1)
        
        # Store reset token in database
        users_collection.update_one(
            {'_id': user['_id']},
            {
                '$set': {
                    'reset_token': reset_token,
                    'reset_token_expiry': reset_expiry
                }
            }
        )
        
        # Try to send email
        try:
            reset_url = f"http://localhost:4200/reset-password?token={reset_token}&userType={data['userType']}"
            
            msg = Message(
                'Password Reset Request - Order App',
                sender=app.config['MAIL_DEFAULT_SENDER'],
                recipients=[user['email']]
            )
            
            msg.html = f'''
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
                <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h1 style="color: #333; text-align: center; margin-bottom: 30px;">Password Reset Request</h1>
                    
                    <p style="color: #555; font-size: 16px;">Hello {user['firstName']},</p>
                    
                    <p style="color: #555; font-size: 16px;">
                        You requested to reset your password for your {data['userType']} account. 
                        Click the button below to reset your password:
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{reset_url}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                            Reset Password
                        </a>
                    </div>
                    
                    <p style="color: #777; font-size: 14px;">Or copy this link: {reset_url}</p>
                    
                    <p style="color: #777; font-size: 14px;">This link expires in 1 hour.</p>
                    
                    <p style="color: #777; font-size: 14px;">
                        If you didn't request this, ignore this email.
                    </p>
                </div>
            </div>
            '''
            
            # Send the email
            mail.send(msg)
            print(f"✅ Email sent successfully to {user['email']}")
            
            return jsonify({
                'success': True,
                'message': 'Password reset link sent to your email successfully.'
            }), 200
            
        except Exception as email_error:
            print(f"❌ Email sending failed: {email_error}")
            
            # Still show console output as backup
            print("\n" + "="*60)
            print(f"EMAIL FAILED - CONSOLE BACKUP FOR: {user['email']}")
            print(f"Reset URL: {reset_url}")
            print(f"Token: {reset_token}")
            print("="*60 + "\n")
            
            # Check specific error types
            error_str = str(email_error)
            if "Username and Password not accepted" in error_str:
                return jsonify({
                    'error': 'Email service configuration error. Please contact administrator.',
                    'debug': 'Gmail credentials need to be configured properly'
                }), 500
            elif "Connection refused" in error_str or "timed out" in error_str:
                return jsonify({
                    'error': 'Email service temporarily unavailable. Please try again later.',
                    'debug': 'Cannot connect to Gmail SMTP server'
                }), 500
            else:
                return jsonify({
                    'error': 'Failed to send reset email. Please contact support.',
                    'debug': str(email_error)
                }), 500
        
    except Exception as e:
        print(f"General error in forgot_password: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': 'Internal server error', 
            'debug': str(e)
        }), 500

@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['token', 'newPassword', 'userType']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate user type
        if data['userType'] not in ['customer', 'seller']:
            return jsonify({'error': 'Invalid user type'}), 400
        
        # Validate password length
        if len(data['newPassword']) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        
        # Select collection based on user type
        if data['userType'] == 'customer':
            users_collection = mongo.db.customers
        else:
            users_collection = mongo.db.sellers
        
        # Find user with reset token
        user = users_collection.find_one({
            'reset_token': data['token'],
            'reset_token_expiry': {'$gt': datetime.utcnow()}
        })
        
        if not user:
            return jsonify({'error': 'Invalid or expired reset token'}), 400
        
        # Update password and remove reset token
        users_collection.update_one(
            {'_id': user['_id']},
            {
                '$set': {
                    'password': generate_password_hash(data['newPassword'])
                },
                '$unset': {
                    'reset_token': '',
                    'reset_token_expiry': ''
                }
            }
        )
        
        return jsonify({
            'success': True,
            'message': 'Password reset successfully. You can now login with your new password.'
        }), 200
        
    except Exception as e:
        print(f"Reset password error: {e}")
        return jsonify({'error': 'Internal server error', 'debug': str(e)}), 500

# Additional route to check if email exists across both collections
@app.route('/api/auth/check-email', methods=['POST'])
def check_email():
    try:
        data = request.get_json()
        email = data.get('email', '').lower()
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        if not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Check in both collections
        customer_exists = mongo.db.customers.find_one({'email': email})
        seller_exists = mongo.db.sellers.find_one({'email': email})
        
        exists_in = []
        if customer_exists:
            exists_in.append('customer')
        if seller_exists:
            exists_in.append('seller')
        
        return jsonify({
            'exists': len(exists_in) > 0,
            'existsIn': exists_in
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Test email configuration route (for debugging)
@app.route('/api/auth/test-email', methods=['POST'])
def test_email():
    try:
        # Check if email is configured
        if (app.config['MAIL_USERNAME'] == 'instaorder2025@gmail.com' and 
            app.config['MAIL_PASSWORD'] == 'YOUR_16_DIGIT_APP_PASSWORD_HERE'):
            return jsonify({
                'configured': False,
                'message': 'Email credentials not configured. Please update MAIL_PASSWORD in server.py'
            }), 200
        
        # Try to send a test email
        try:
            msg = Message(
                'Test Email Configuration',
                sender=app.config['MAIL_DEFAULT_SENDER'],
                recipients=[app.config['MAIL_USERNAME']]
            )
            msg.body = 'This is a test email to verify your email configuration is working.'
            
            mail.send(msg)
            return jsonify({
                'configured': True,
                'message': 'Email configuration is working correctly!'
            }), 200
            
        except Exception as e:
            return jsonify({
                'configured': False,
                'message': f'Email configuration error: {str(e)}'
            }), 500
            
    except Exception as e:
        return jsonify({
            'configured': False,
            'message': f'Server error: {str(e)}'
        }), 500

# Register all blueprints
app.register_blueprint(customer_bp, url_prefix="/api/customer")
app.register_blueprint(seller_bp, url_prefix="/api/seller")
app.register_blueprint(product_bp, url_prefix="/api/product")
app.register_blueprint(order_bp, url_prefix="/api/order")

if __name__ == '__main__':
    app.run(debug=True)