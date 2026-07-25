import json

from app.db import query


def log_activity(entity_type, entity_id, action, performed_by, details="", changes=None):
    """Log an activity to the activity_logs table. Never raises — mirrors the Node fire-and-forget logger."""
    try:
        query(
            """INSERT INTO activity_logs (entity_type, entity_id, action, details, changes, performed_by)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            [entity_type, entity_id, action, details or "", json.dumps(changes or {}), performed_by],
        )
    except Exception as err:
        print(f"[ActivityLogger] Failed to log activity: {err}")
