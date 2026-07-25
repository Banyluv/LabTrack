import json

from app.db import query


def send_notification(user_id, type, title, message="", data=None, link=""):
    """Insert a targeted notification. Never raises — mirrors the Node fire-and-forget sender."""
    try:
        query(
            """INSERT INTO notifications (user_id, type, title, message, data, link)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            [user_id, type, title, message or "", json.dumps(data or {}), link or ""],
        )
    except Exception as err:
        print(f"[NotificationService] Failed to send notification: {err}")


def get_unread_count(user_id):
    try:
        row = query(
            "SELECT COUNT(*) as count FROM notifications WHERE user_id = %s AND is_read = false",
            [user_id],
        )
        return int(row[0]["count"])
    except Exception as err:
        print(f"[NotificationService] Failed to get unread count: {err}")
        return 0
