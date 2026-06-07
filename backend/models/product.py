from bson import ObjectId

def format_product(product):
    return {
        "id": str(product.get("_id", "")),
        "name": product.get("name", ""),
        "description": product.get("description", ""),
        "price": product.get("price", 0),
        "quantity": product.get("quantity", 0),
        "seller_id": str(product.get("seller_id", "")),
        "shop_address": product.get("shop_address", ""),
        "pincode": product.get("pincode", ""),
        "shop_name": product.get("shop_name", ""),
        "district": product.get("district", ""),
        "city": product.get("city", "")
    }

def validate_product(data):
    required_fields = ["name", "description", "price", "quantity", "seller_id", "shop_address", "pincode","shop_name", "district", "city"]
    return all(field in data for field in required_fields)
