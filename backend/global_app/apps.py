import logging
import os

from django.apps import AppConfig

logger = logging.getLogger("global_app")


class GlobalAppConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "global_app"

    def ready(self):
        """Restore the global DB from R2 if it was wiped (e.g. Render restart).

        Django calls ready() once after the app registry is fully loaded,
        before any requests are handled. If the global_system.db file is
        missing and R2 is configured, download it so migrate (and all
        subsequent requests) operate on the real data rather than an empty DB.
        """
        from django.conf import settings

        if not settings.R2_ENABLED:
            return

        path = str(settings.DATA_DIR / "global_system.db")
        if os.path.exists(path):
            return  # already present, nothing to do

        try:
            from core import r2_client
            restored = r2_client.download_global_db(path)
            if restored:
                logger.info("global_app.ready: restored global DB from R2.")
            else:
                logger.info("global_app.ready: no global DB backup in R2 yet; fresh DB will be created.")
        except Exception as exc:
            logger.error("global_app.ready: failed to restore global DB from R2: %s", exc)
