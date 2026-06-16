"""
Database router separating GLOBAL data from per-TENANT data.

Reads/writes for models in the ``tenants`` app are directed to the currently
active tenant database (whose alias is held in the thread-local set by the
middleware). Everything else (auth, global_app, admin, sessions, ...) uses the
``default`` global database.

``allow_migrate`` enforces the same split at schema level:
  * tenant-app models only ever migrate onto a ``tenant_*`` alias;
  * all other apps only migrate onto ``default``.
This keeps tenant files containing *only* the tenant schema and the global file
containing everything else.
"""
from tenants.context import get_current_tenant

TENANT_APP_LABEL = "tenants"


class TenantRouter:
    def _is_tenant_model(self, model) -> bool:
        return model._meta.app_label == TENANT_APP_LABEL

    def db_for_read(self, model, **hints):
        if self._is_tenant_model(model):
            return get_current_tenant()  # may be None if no tenant active
        return "default"

    def db_for_write(self, model, **hints):
        if self._is_tenant_model(model):
            return get_current_tenant()
        return "default"

    def allow_relation(self, obj1, obj2, **hints):
        # Allow relations within the same database; cross-DB FKs are avoided by
        # design (tenant models reference each other; global models reference
        # each other; cross-references use loose id fields, not FKs).
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        is_tenant_alias = db.startswith("tenant_")
        if app_label == TENANT_APP_LABEL:
            # Tenant schema lives ONLY in tenant databases.
            return is_tenant_alias
        # Every other app lives ONLY in the global default database.
        return db == "default"
