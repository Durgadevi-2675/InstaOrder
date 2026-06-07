from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from datetime import datetime
import uuid

product_bp = Blueprint('product_bp', __name__)

def format_product(product):
    """Format product data for API response"""
    return {
        "id": str(product.get("_id", "")),
        "sellerId": str(product.get("sellerId", "")),
        "shopId": str(product.get("shopId", "")),
        "name": product.get("name", ""),
        "description": product.get("description", ""),
        "price": float(product.get("price", 0)),
        "category": product.get("category", ""),
        "images": product.get("images", []),
        "quantity": int(product.get("quantity", 0)),
        "isAvailable": product.get("isAvailable", True),
        "tags": product.get("tags", []),
        # Add new fields
        "shopName": product.get("shopName", ""),
        "district": product.get("district", ""),
        "city": product.get("city", ""),
        "createdAt": product.get("createdAt"),
        "updatedAt": product.get("updatedAt")
    }

def validate_product_data(data):
    """Validate required product fields"""
    required_fields = [
        "name", "description", "price", "category", 
        "quantity", "sellerId", "shopName", "district", "city"
    ]
    missing_fields = [field for field in required_fields if not data.get(field)]
    
    if missing_fields:
        return False, f"Missing required fields: {', '.join(missing_fields)}"
    
    # Validate data types
    try:
        float(data.get("price", 0))
        int(data.get("quantity", 0))
    except (ValueError, TypeError):
        return False, "Price must be a number and quantity must be an integer"
    
    if float(data.get("price", 0)) < 0:
        return False, "Price must be non-negative"
    
    if int(data.get("quantity", 0)) < 0:
        return False, "Quantity must be non-negative"
    
    return True, ""

@product_bp.route('', methods=['POST'])
def create_product():
    """Create a new product"""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Validate product data
        is_valid, error_message = validate_product_data(data)
        if not is_valid:
            return jsonify({"error": error_message}), 400
        
        db = current_app.mongo.db
        
        # Verify seller exists
        seller = db.sellers.find_one({"_id": ObjectId(data["sellerId"])})
        if not seller:
            return jsonify({"error": "Seller not found"}), 404
        
        # Prepare product data
        product_data = {
            "sellerId": data["sellerId"],
            "shopId": data.get("shopId", data["sellerId"]),  # Default to sellerId if no shopId
            "name": data["name"].strip(),
            "description": data["description"].strip(),
            "price": float(data["price"]),
            "category": data["category"],
            "images": data.get("images", []),
            "quantity": int(data["quantity"]),
            "isAvailable": data.get("isAvailable", True),
            "tags": data.get("tags", []),
            "shopName": data["shopName"].strip(),
            "district": data["district"].strip(),
            "city": data["city"].strip(),
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        
        # Insert product
        result = db.products.insert_one(product_data)
        
        if result.inserted_id:
            # Get the created product
            created_product = db.products.find_one({"_id": result.inserted_id})
            return jsonify(format_product(created_product)), 201
        else:
            return jsonify({"error": "Failed to create product"}), 500
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@product_bp.route('/<product_id>', methods=['GET'])
def get_product(product_id):
    """Get a specific product by ID"""
    try:
        db = current_app.mongo.db
        
        if not ObjectId.is_valid(product_id):
            return jsonify({"error": "Invalid product ID"}), 400
        
        product = db.products.find_one({"_id": ObjectId(product_id)})
        
        if not product:
            return jsonify({"error": "Product not found"}), 404
        
        return jsonify(format_product(product)), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@product_bp.route('/seller/<seller_id>', methods=['GET'])
def get_products_by_seller(seller_id):
    """Get all products for a specific seller"""
    try:
        db = current_app.mongo.db
        
        # Find all products for this seller
        products = list(db.products.find({"sellerId": seller_id}))
        
        # Format products for response
        formatted_products = [format_product(product) for product in products]
        
        return jsonify(formatted_products), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@product_bp.route('/<product_id>', methods=['PUT'])
def update_product(product_id):
    """Update an existing product"""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        db = current_app.mongo.db
        
        if not ObjectId.is_valid(product_id):
            return jsonify({"error": "Invalid product ID"}), 400
        
        # Check if product exists
        existing_product = db.products.find_one({"_id": ObjectId(product_id)})
        if not existing_product:
            return jsonify({"error": "Product not found"}), 404
        
        # Prepare update data
        update_data = {"updatedAt": datetime.utcnow()}
        
        # Update only provided fields
        updatable_fields = ["name", "description", "price", "category", "images", "quantity", "isAvailable", "tags"]
        for field in updatable_fields:
            if field in data:
                if field == "name" and data[field]:
                    update_data[field] = data[field].strip()
                elif field == "description" and data[field]:
                    update_data[field] = data[field].strip()
                elif field == "price":
                    update_data[field] = float(data[field])
                elif field == "quantity":
                    update_data[field] = int(data[field])
                else:
                    update_data[field] = data[field]
        
        # Update product
        result = db.products.update_one(
            {"_id": ObjectId(product_id)},
            {"$set": update_data}
        )
        
        if result.modified_count > 0:
            # Get updated product
            updated_product = db.products.find_one({"_id": ObjectId(product_id)})
            return jsonify(format_product(updated_product)), 200
        else:
            return jsonify({"error": "No changes made"}), 400
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@product_bp.route('/<product_id>', methods=['DELETE'])
def delete_product(product_id):
    """Delete a product"""
    try:
        db = current_app.mongo.db
        
        if not ObjectId.is_valid(product_id):
            return jsonify({"error": "Invalid product ID"}), 400
        
        # Check if product exists
        existing_product = db.products.find_one({"_id": ObjectId(product_id)})
        if not existing_product:
            return jsonify({"error": "Product not found"}), 404
        
        # Delete product
        result = db.products.delete_one({"_id": ObjectId(product_id)})
        
        if result.deleted_count > 0:
            return jsonify({"message": "Product deleted successfully"}), 200
        else:
            return jsonify({"error": "Failed to delete product"}), 500
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@product_bp.route('', methods=['GET'])
def get_all_products():
    """Get all products with optional filtering"""
    try:
        db = current_app.mongo.db
        
        # Get query parameters for filtering
        category = request.args.get('category')
        search_term = request.args.get('search')
        is_available = request.args.get('isAvailable')
        
        # Build filter query
        filter_query = {}
        
        if category:
            filter_query['category'] = category
        
        if search_term:
            filter_query['$or'] = [
                {"name": {"$regex": search_term, "$options": "i"}},
                {"description": {"$regex": search_term, "$options": "i"}},
                {"tags": {"$in": [search_term]}}
            ]
        
        if is_available is not None:
            filter_query['isAvailable'] = is_available.lower() == 'true'
        
        # Get products
        products = list(db.products.find(filter_query))
        
        # Format products for response
        formatted_products = [format_product(product) for product in products]
        
        return jsonify(formatted_products), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@product_bp.route('/categories', methods=['GET'])
def get_categories():
    """Get all unique product categories"""
    try:
        db = current_app.mongo.db
        
        # Get distinct categories
        categories = db.products.distinct("category")
        
        return jsonify(categories), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@product_bp.route('/search', methods=['POST'])
def search_products():
    """Advanced product search with filters"""
    try:
        data = request.json or {}
        db = current_app.mongo.db
        
        # Build search query
        query = {}
        
        if data.get('searchTerm'):
            query['$or'] = [
                {"name": {"$regex": data['searchTerm'], "$options": "i"}},
                {"description": {"$regex": data['searchTerm'], "$options": "i"}},
                {"tags": {"$in": [data['searchTerm']]}}
            ]
        
        if data.get('category'):
            query['category'] = data['category']
        
        if data.get('minPrice') is not None or data.get('maxPrice') is not None:
            price_query = {}
            if data.get('minPrice') is not None:
                price_query['$gte'] = float(data['minPrice'])
            if data.get('maxPrice') is not None:
                price_query['$lte'] = float(data['maxPrice'])
            query['price'] = price_query
        
        if data.get('isAvailable') is not None:
            query['isAvailable'] = data['isAvailable']
        
        # Execute search
        products = list(db.products.find(query))
        
        # Format results
        formatted_products = [format_product(product) for product in products]
        
        return jsonify(formatted_products), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Legacy route for backward compatibility
@product_bp.route('/add', methods=['POST'])
def add_product():
    """Legacy add product route"""
    return create_product()