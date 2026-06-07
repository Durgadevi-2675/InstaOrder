from bson import ObjectId

def format_seller(seller):
    return {
        "id": str(seller.get("_id", "")),
        "name": seller.get("name", ""),
        "email": seller.get("email", ""),
        "shop_name": seller.get("shop_name", ""),
        "address": seller.get("address", ""),
        "pincode": seller.get("pincode", "")
    }

def validate_seller(data):
    required_fields = ["name", "email", "password", "shop_name", "address", "pincode"]
    return all(field in data for field in required_fields)
