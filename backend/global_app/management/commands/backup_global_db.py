"""
Management command: backup_global_db

Uploads global_system.db to Cloudflare R2.
Called from build.sh after migrate + ensure_superadmin so that any schema
changes or new accounts written during the build are persisted before the
first request arrives.

Safe to run when R2 is not configured — exits silently as a no-op.

Usage:
    python manage.py backup_global_db
"""
from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Upload global_system.db to R2 (run after migrate to persist build-time writes)."

    def handle(self, *args, **options):
        if not settings.R2_ENABLED:
            self.stdout.write("R2 not configured — skipping backup.")
            return

        path = str(settings.DATA_DIR / "global_system.db")
        self.stdout.write(f"Uploading global DB to R2: {path}")

        from core import r2_client
        try:
            r2_client.upload_global_db(path)
            self.stdout.write(self.style.SUCCESS("Global DB uploaded to R2 successfully."))
        except r2_client.R2SyncError as exc:
            # Don't fail the build — local file is still correct.
            self.stderr.write(self.style.WARNING(f"R2 upload failed (non-fatal): {exc}"))
