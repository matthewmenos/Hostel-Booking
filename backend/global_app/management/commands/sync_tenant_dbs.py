"""
Management command: sync_tenant_dbs

Uploads every tenant_<slug>.db file found in DB_STORE_DIR to Cloudflare R2.
Run this once after setting up R2 credentials to seed the bucket with
any tenant databases that were created before R2 was configured.

Usage:
    python manage.py sync_tenant_dbs
    python manage.py sync_tenant_dbs --dry-run   # list files without uploading
"""
import os

from django.conf import settings
from django.core.management.base import BaseCommand

from core import r2_client


class Command(BaseCommand):
    help = "Upload all local tenant .db files to R2."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List files that would be uploaded without actually uploading.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        if not settings.R2_ENABLED:
            self.stderr.write(self.style.ERROR(
                "R2 is not configured. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, "
                "R2_ENDPOINT_URL, R2_DB_BUCKET, and R2_MEDIA_BUCKET in your .env file."
            ))
            return

        db_store = settings.DB_STORE_DIR
        files = [
            f for f in os.listdir(db_store)
            if f.startswith("tenant_") and f.endswith(".db")
        ]

        if not files:
            self.stdout.write("No tenant .db files found in DB_STORE_DIR.")
            return

        self.stdout.write(f"Found {len(files)} tenant DB(s) in {db_store}:")

        uploaded = 0
        failed = 0

        for filename in sorted(files):
            local_path = str(db_store / filename)
            key = r2_client.db_object_key(filename)

            if dry_run:
                self.stdout.write(f"  [dry-run] {filename} → {key}")
                continue

            try:
                r2_client.upload_db(local_path, key)
                self.stdout.write(self.style.SUCCESS(f"  ✓ {filename} → {key}"))
                uploaded += 1
            except r2_client.R2SyncError as exc:
                self.stderr.write(self.style.ERROR(f"  ✗ {filename}: {exc}"))
                failed += 1

        if not dry_run:
            self.stdout.write(f"\nDone: {uploaded} uploaded, {failed} failed.")
            if failed:
                raise SystemExit(1)
