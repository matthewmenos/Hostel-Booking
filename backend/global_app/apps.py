import logging
import os
import threading

from django.apps import AppConfig

logger = logging.getLogger("global_app")


def _run_expire_bookings():
    """Expire stale pending bookings in a background thread at startup.

    Runs after a short delay so the DB connection pool is fully ready.
    This frees beds that were left occupied by bookings that expired while
    the server was down (i.e. between Render deploys).
    """
    import time
    time.sleep(5)
    try:
        from django.core.management import call_command
        call_command("expire_bookings", verbosity=0)
        logger.info("global_app.ready: startup expire_bookings completed.")
    except Exception as exc:
        logger.error("global_app.ready: expire_bookings failed: %s", exc)


class GlobalAppConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "global_app"

    def ready(self):
        """Restore the global DB from R2 if it was wiped (e.g. Render restart),
        then expire any stale bookings so bed availability is accurate.
        """
        from django.conf import settings

        # Restore global DB from R2 if missing (Render ephemeral filesystem)
        if settings.R2_ENABLED:
            path = str(settings.DATA_DIR / "global_system.db")
            if not os.path.exists(path):
                try:
                    from core import r2_client
                    restored = r2_client.download_global_db(path)
                    if restored:
                        logger.info("global_app.ready: restored global DB from R2.")
                    else:
                        logger.info("global_app.ready: no global DB backup in R2 yet.")
                except Exception as exc:
                    logger.error("global_app.ready: failed to restore global DB from R2: %s", exc)

        # Expire stale bookings in background so beds show as available.
        # Skip during management commands (migrate, collectstatic, etc.) using
        # the DJANGO_MANAGECMD env var set by manage.py, and skip the dev
        # reloader's parent process so the thread only runs in the child.
        import sys
        argv1 = sys.argv[1] if len(sys.argv) > 1 else ""
        skip_cmds = {"migrate", "makemigrations", "collectstatic", "expire_bookings",
                     "restore_global_db", "backup_global_db", "ensure_superadmin",
                     "createsuperuser", "shell", "dbshell"}
        is_skip_cmd = argv1 in skip_cmds
        is_reloader_parent = settings.DEBUG and os.environ.get("RUN_MAIN") != "true"
        if not is_skip_cmd and not is_reloader_parent:
            t = threading.Thread(target=_run_expire_bookings, daemon=True, name="startup-expire")
            t.start()
