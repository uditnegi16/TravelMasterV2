"""
Lambda handler for the API Gateway WebSocket API routes
($connect, $disconnect, $default).

This is a SEPARATE Lambda entry point from lambda_handler.py (the
main FastAPI/Mangum app). API Gateway WebSocket API events have a
completely different shape from REST API proxy events, and Mangum
does not support them - hence a dedicated raw handler here.

This function and the main agent Lambda share the same Redis
instance (core.redis_client) and the same ConnectionManager class,
so a client_id -> connectionId mapping written here by $connect is
immediately visible to manager.send() calls made from
chat_routes.py / routes.py in the main app.
"""

from api.websocket_manager import manager


def handler(event, context):
    request_context = event.get("requestContext", {})
    route_key = request_context.get("routeKey")
    connection_id = request_context.get("connectionId")

    if route_key == "$connect":
        params = event.get("queryStringParameters") or {}
        client_id = params.get("client_id")

        if not client_id:
            return {"statusCode": 400, "body": "Missing client_id query parameter"}

        manager.register(client_id, connection_id)
        return {"statusCode": 200}

    if route_key == "$disconnect":
        manager.unregister_by_connection(connection_id)
        return {"statusCode": 200}

    return {"statusCode": 200}