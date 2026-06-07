from bson import ObjectId

def format_customer(customer):
    return {
        "id": str(customer.get("_id", "")),
        "name": customer.get("name", ""),
        "email": customer.get("email", ""),
    }

def validate_customer(data):
    required_fields = ["name", "email", "password"]
    return all(field in data for field in required_fields)
