"""
Media storage backend for Cloudflare R2.

This is only referenced from ``settings.STORAGES`` when ``R2_ENABLED`` is true
(i.e. credentials are present). It subclasses django-storages' S3 backend and
points it at the R2 endpoint, so hostel images and student verification photos
are uploaded to R2 transparently via the normal Django file fields.

When R2 is not configured, settings falls back to the default
``FileSystemStorage`` and this class is never imported.
"""
from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage


class R2MediaStorage(S3Boto3Storage):
    """django-storages S3 backend configured for Cloudflare R2."""

    bucket_name = settings.R2_BUCKET_NAME
    endpoint_url = settings.R2_ENDPOINT_URL
    access_key = settings.R2_ACCESS_KEY_ID
    secret_key = settings.R2_SECRET_ACCESS_KEY
    region_name = "auto"
    # R2 does not support ACLs; never send them.
    default_acl = None
    querystring_auth = False
    # Keep uploaded media under a dedicated prefix.
    location = "media"
    file_overwrite = False

    @property
    def custom_domain(self):
        # If a public URL is configured, serve files from it (CDN/public bucket).
        public = settings.R2_PUBLIC_URL.strip()
        if public:
            return public.replace("https://", "").replace("http://", "").rstrip("/")
        return None
