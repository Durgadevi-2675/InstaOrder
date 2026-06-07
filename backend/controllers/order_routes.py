# controllers/order_routes.py
from flask import Blueprint, request, jsonify
from datetime import datetime
from bson.objectid import ObjectId

order_bp = Blueprint('order', __name__)

@order_bp.route('/create', methods=['POST'])
def create_order():
    try:
        from server import mongo
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['customerId', 'productId', 'sellerId', 'quantity', 'customerInfo']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate customer info
        customer_info = data['customerInfo']
        required_customer_fields = ['name', 'phone', 'address']
        for field in required_customer_fields:
            if field not in customer_info or not customer_info[field]:
                return jsonify({'error': f'Customer {field} is required'}), 400
        
        # Get product details
        product = mongo.db.products.find_one({'_id': ObjectId(data['productId'])})
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        # Check product availability
        if not product.get('isAvailable', False):
            return jsonify({'error': 'Product is not available'}), 400
        
        # Check quantity availability
        if product['quantity'] < data['quantity']:
            return jsonify({'error': 'Insufficient quantity available'}), 400
        
        # Calculate total amount
        total_amount = product['price'] * data['quantity']
        
        # Create order document
        order_data = {
            'customerId': data['customerId'],
            'productId': data['productId'],
            'sellerId': data['sellerId'],
            'quantity': data['quantity'],
            'totalAmount': total_amount,
            'status': 'pending',  # pending, confirmed, preparing, ready, completed, cancelled
            'customerInfo': {
                'name': customer_info['name'],
                'phone': customer_info['phone'],
                'address': customer_info['address'],
                'email': customer_info.get('email', '')
            },
            'productInfo': {
                'name': product['name'],
                'price': product['price'],
                'image': product['images'][0] if product.get('images') else '',
                'category': product.get('category', 'Uncategorized'),
                'shopName': product.get('shopName', 'Unknown Shop')
            },
            'orderDate': datetime.utcnow(),
            'estimatedReadyTime': data.get('estimatedReadyTime'),
            'specialInstructions': data.get('specialInstructions', ''),
            'paymentStatus': 'pending',  # pending, paid, failed
            'paymentMethod': data.get('paymentMethod', 'cash_on_delivery'),
            'isNewOrder': True,  # Flag for new orders (for notifications)
            'notificationSent': False  # Track if notification was sent
        }
        
        # Insert order
        result = mongo.db.orders.insert_one(order_data)
        
        if result.inserted_id:
            # Update product quantity
            new_quantity = product['quantity'] - data['quantity']
            mongo.db.products.update_one(
                {'_id': ObjectId(data['productId'])},
                {
                    '$set': {'quantity': new_quantity},
                    '$inc': {'ordersCount': 1}
                }
            )
            
            # If quantity becomes 0, mark as unavailable
            if new_quantity == 0:
                mongo.db.products.update_one(
                    {'_id': ObjectId(data['productId'])},
                    {'$set': {'isAvailable': False}}
                )
            
            # Get the created order with ID
            created_order = mongo.db.orders.find_one({'_id': result.inserted_id})
            created_order['id'] = str(created_order['_id'])
            del created_order['_id']
            
            # Convert datetime to ISO string for JSON response
            if 'orderDate' in created_order:
                created_order['orderDate'] = created_order['orderDate'].isoformat()
            
            return jsonify({
                'message': 'Order created successfully',
                'order': created_order
            }), 201
        else:
            return jsonify({'error': 'Failed to create order'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@order_bp.route('/seller/<seller_id>', methods=['GET'])
def get_seller_orders(seller_id):
    try:
        from server import mongo
        
        # Get query parameters
        status_filter = request.args.get('status', 'all')
        new_only = request.args.get('new_only', 'false').lower() == 'true'
        
        # Build query
        query = {'sellerId': seller_id}
        
        if status_filter != 'all':
            query['status'] = status_filter
            
        if new_only:
            query['isNewOrder'] = True
        
        # Get orders for seller
        orders = list(mongo.db.orders.find(query))
        
        # Convert ObjectId to string and format response
        formatted_orders = []
        for order in orders:
            order['id'] = str(order['_id'])
            del order['_id']
            # Convert datetime to ISO string
            if 'orderDate' in order:
                order['orderDate'] = order['orderDate'].isoformat()
            if 'estimatedReadyTime' in order and order['estimatedReadyTime']:
                order['estimatedReadyTime'] = order['estimatedReadyTime'].isoformat()
            formatted_orders.append(order)
        
        # Sort by order date (newest first)
        formatted_orders.sort(key=lambda x: x['orderDate'], reverse=True)
        
        # Count new orders
        new_orders_count = mongo.db.orders.count_documents({
            'sellerId': seller_id, 
            'isNewOrder': True
        })
        
        return jsonify({
            'orders': formatted_orders,
            'totalOrders': len(formatted_orders),
            'newOrdersCount': new_orders_count,
            'hasNewOrders': new_orders_count > 0
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@order_bp.route('/seller/<seller_id>/new', methods=['GET'])
def get_new_orders(seller_id):
    """Get only new/unread orders for notifications"""
    try:
        from server import mongo
        
        # Get new orders for seller
        orders = list(mongo.db.orders.find({
            'sellerId': seller_id, 
            'isNewOrder': True
        }))
        
        # Convert ObjectId to string and format response
        formatted_orders = []
        for order in orders:
            order['id'] = str(order['_id'])
            del order['_id']
            # Convert datetime to ISO string
            if 'orderDate' in order:
                order['orderDate'] = order['orderDate'].isoformat()
            formatted_orders.append(order)
        
        # Sort by order date (newest first)
        formatted_orders.sort(key=lambda x: x['orderDate'], reverse=True)
        
        return jsonify({
            'newOrders': formatted_orders,
            'count': len(formatted_orders)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@order_bp.route('/<order_id>/mark-read', methods=['PUT'])
def mark_order_as_read(order_id):
    """Mark an order as read (remove new order flag)"""
    try:
        from server import mongo
        
        # Update order to remove new order flag
        result = mongo.db.orders.update_one(
            {'_id': ObjectId(order_id)},
            {
                '$set': {
                    'isNewOrder': False,
                    'readAt': datetime.utcnow()
                }
            }
        )
        
        if result.matched_count == 0:
            return jsonify({'error': 'Order not found'}), 404
        
        return jsonify({'message': 'Order marked as read'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@order_bp.route('/customer/<customer_id>', methods=['GET'])
def get_customer_orders(customer_id):
    try:
        from server import mongo
        
        # Get orders for customer
        orders = list(mongo.db.orders.find({'customerId': customer_id}))
        
        # Convert ObjectId to string and format response
        formatted_orders = []
        for order in orders:
            order['id'] = str(order['_id'])
            del order['_id']
            # Convert datetime to ISO string
            if 'orderDate' in order:
                order['orderDate'] = order['orderDate'].isoformat()
            if 'estimatedReadyTime' in order and order['estimatedReadyTime']:
                order['estimatedReadyTime'] = order['estimatedReadyTime'].isoformat()
            formatted_orders.append(order)
        
        # Sort by order date (newest first)
        formatted_orders.sort(key=lambda x: x['orderDate'], reverse=True)
        
        return jsonify({
            'orders': formatted_orders,
            'totalOrders': len(formatted_orders)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@order_bp.route('/<order_id>/status', methods=['PUT'])
def update_order_status(order_id):
    try:
        from server import mongo
        data = request.get_json()
        
        if 'status' not in data:
            return jsonify({'error': 'Status is required'}), 400
        
        valid_statuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']
        if data['status'] not in valid_statuses:
            return jsonify({'error': 'Invalid status'}), 400
        
        # Update order status
        result = mongo.db.orders.update_one(
            {'_id': ObjectId(order_id)},
            {
                '$set': {
                    'status': data['status'],
                    'lastUpdated': datetime.utcnow(),
                    'statusUpdatedBy': data.get('updatedBy', 'seller')
                }
            }
        )
        
        if result.matched_count == 0:
            return jsonify({'error': 'Order not found'}), 404
        
        return jsonify({'message': 'Order status updated successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@order_bp.route('/<order_id>', methods=['GET'])
def get_order_details(order_id):
    try:
        from server import mongo
        
        order = mongo.db.orders.find_one({'_id': ObjectId(order_id)})
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        
        # Format response
        order['id'] = str(order['_id'])
        del order['_id']
        
        # Convert datetime to ISO string
        if 'orderDate' in order:
            order['orderDate'] = order['orderDate'].isoformat()
        if 'estimatedReadyTime' in order and order['estimatedReadyTime']:
            order['estimatedReadyTime'] = order['estimatedReadyTime'].isoformat()
        
        return jsonify({'order': order}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500