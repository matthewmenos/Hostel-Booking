"""
Management command: restore_global_db

Downloads global_system.db from Cloudflare R2 if it is missing or empty locally.
Idempotent — safe to run on every deploy even if the file already exists.

Called from build.sh before migrate so existing data is present when Django
applies any pending migrations.
"""
import os

from django.conf import settings
from django.core.management.base import BaseCommand

# SQLite files start with a 100-byte header. A file smaller than this is
# either empty (created by mkdir/touch) or corrupt — restore from R2 either way.
_MIN_VALID_BYTES = 100


class Command(BaseCommand):
    help = "Restore global_system.db from R2 if missing or empty (Render ephemeral-disk fix)."

    def handle(self, *args, **options):
        path = str(settings.DATA_DIR / "global_system.db")

        file_size = os.path.getsize(path) if os.path.exists(path) else 0

        if file_size >= _MIN_VALID_BYTES:
            self.stdout.write(
                f"Global DB already present ({file_size} bytes) — skipping restore."
            )
            return

        if not settings.R2_ENABLED:
            if file_size == 0:
                self.stdout.write(
                    "R2 not configured and DB is empty — a fresh DB will be created by migrate."
                )
            return

        if file_size > 0:
            self.stdout.write(
                self.style.WARNING(
                    f"Global DB is suspiciously small ({file_size} bytes) — restoring from R2."
                )
            )
        else:
            self.stdout.write("Global DB missing — attempting restore from R2…")

        from core import r2_client
        restored = r2_client.download_global_db(path)
        if restored:
            size_after = os.path.getsize(path)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Global DB restored from R2 successfully ({size_after} bytes)."
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    "No backup found in R2 (first deploy or bucket empty). "
                    "A fresh DB will be created by migrate."
                )
            )
