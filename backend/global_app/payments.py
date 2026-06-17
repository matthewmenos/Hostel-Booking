"""
Provider-agnostic payment initiation layer (stubbed).

Ghanaian gateways (Paystack, Hubtel) are integrated here later. For now each
provider returns a stub authorization payload so the booking pipeline and the
frontend payment tracker can be built and tested end-to-end without live keys.

To go live, replace the body of each ``_initiate_*`` with a real API call and
store the returned reference/authorization URL on the ``Payment`` row.
"""
from __future__ import annotations

import uuid

from .models import Payment, PaymentProvider


def initiate_payment(payment: Payment) -> dict:
    """Kick off a payment with the selected provider.

    Returns a dict describing how the client should proceed (e.g. an
    authorization URL to redirect to). Persists the generated reference.
    """
    handler = {
        PaymentProvider.PAYSTACK: _initiate_paystack,
        PaymentProvider.HUBTEL: _initiate_hubtel,
        PaymentProvider.MANUAL: _initiate_manual,
    }.get(payment.provider, _initiate_manual)
    return handler(payment)


def _stub_reference(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def _initiate_paystack(payment: Payment) -> dict:
    # TODO: POST https://api.paystack.co/transaction/initialize with secret key.
    payment.reference = _stub_reference("psk")
    payment.authorization_url = f"https://checkout.paystack.com/stub/{payment.reference}"
    payment.save(update_fields=["reference", "authorization_url"])
    return {
        "provider": "paystack",
        "reference": payment.reference,
        "authorization_url": payment.authorization_url,
        "stub": True,
    }


def _initiate_hubtel(payment: Payment) -> dict:
    # TODO: call Hubtel's checkout API.
    payment.reference = _stub_reference("hub")
    payment.authorization_url = f"https://pay.hubtel.com/stub/{payment.reference}"
    payment.save(update_fields=["reference", "authorization_url"])
    return {
        "provider": "hubtel",
        "reference": payment.reference,
        "authorization_url": payment.authorization_url,
        "stub": True,
    }


def _initiate_manual(payment: Payment) -> dict:
    payment.reference = _stub_reference("man")
    payment.authorization_url = ""
    payment.save(update_fields=["reference", "authorization_url"])
    return {"provider": "manual", "reference": payment.reference, "stub": True}
