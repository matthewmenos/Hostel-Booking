"""
Payment initiation and payout layer — Paystack integration.

Initiation:
  POST https://api.paystack.co/transaction/initialize
  Returns an authorization_url the student opens to complete payment.

Webhook (charge.success):
  Handled in views.PaystackWebhookView — flips booking to paid_awaiting_approval.

Payout (admin approval):
  POST https://api.paystack.co/transfer
  Sends manager's share from platform Paystack balance to their recipient code.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import uuid

import requests
from django.conf import settings

from .models import Payment, PaymentProvider

logger = logging.getLogger("global_app.payments")

PAYSTACK_SECRET = os.getenv("PAYSTACK_SECRET_KEY", "")
PAYSTACK_BASE = "https://api.paystack.co"

# Platform commission rate (e.g. 0.10 = 10%).
COMMISSION_RATE = float(os.getenv("PLATFORM_COMMISSION_RATE", "0.10"))


def _paystack_headers() -> dict:
    return {"Authorization": f"Bearer {PAYSTACK_SECRET}", "Content-Type": "application/json"}


def _stub_reference(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def initiate_payment(payment: Payment) -> dict:
    handler = {
        PaymentProvider.PAYSTACK: _initiate_paystack,
        PaymentProvider.HUBTEL:   _initiate_hubtel,
        PaymentProvider.MANUAL:   _initiate_manual,
    }.get(payment.provider, _initiate_manual)
    return handler(payment)


# ---------------------------------------------------------------------------
# Paystack: transaction initialize
# ---------------------------------------------------------------------------

def _initiate_paystack(payment: Payment) -> dict:
    if not PAYSTACK_SECRET:
        return _initiate_paystack_stub(payment)

    reference = _stub_reference("psk")
    booking = payment.booking
    student = booking.student

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    callback_url = f"{frontend_url}/payment/callback?reference={reference}"

    payload = {
        "email": student.email,
        "amount": int(payment.amount * 100),  # Paystack expects pesewas
        "reference": reference,
        "currency": "GHS",
        "callback_url": callback_url,
        "metadata": {
            "booking_id": booking.pk,
            "payment_id": payment.pk,
            "hostel_slug": booking.hostel.slug,
            "student_username": student.username,
        },
    }

    try:
        resp = requests.post(
            f"{PAYSTACK_BASE}/transaction/initialize",
            json=payload,
            headers=_paystack_headers(),
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()["data"]
        payment.reference = data["reference"]
        payment.authorization_url = data["authorization_url"]
        payment.save(update_fields=["reference", "authorization_url"])
        return {
            "provider": "paystack",
            "reference": payment.reference,
            "authorization_url": payment.authorization_url,
        }
    except Exception as exc:
        logger.error("Paystack initialize failed: %s", exc)
        # Fall back to stub so booking pipeline doesn't crash.
        return _initiate_paystack_stub(payment)


def _initiate_paystack_stub(payment: Payment) -> dict:
    payment.reference = _stub_reference("psk")
    payment.authorization_url = f"https://checkout.paystack.com/stub/{payment.reference}"
    payment.save(update_fields=["reference", "authorization_url"])
    return {
        "provider": "paystack",
        "reference": payment.reference,
        "authorization_url": payment.authorization_url,
        "stub": True,
    }


# ---------------------------------------------------------------------------
# Webhook signature verification
# ---------------------------------------------------------------------------

def verify_paystack_signature(payload_bytes: bytes, signature: str) -> bool:
    # In dev (no secret configured) accept all webhook calls so the pipeline
    # can be tested end-to-end without a live Paystack account.
    if not PAYSTACK_SECRET:
        return True
    computed = hmac.new(
        PAYSTACK_SECRET.encode("utf-8"), payload_bytes, hashlib.sha512
    ).hexdigest()
    return hmac.compare_digest(computed, signature)


# ---------------------------------------------------------------------------
# Paystack Transfer API (manager payout)
# ---------------------------------------------------------------------------

def initiate_payout(payment: Payment) -> dict:
    """
    Transfer the manager's share from the platform Paystack balance to the
    manager's registered recipient code.

    Returns a dict with transfer_code and transfer_reference on success.
    Raises RuntimeError on failure so the caller can surface it.
    """
    booking = payment.booking
    manager = booking.hostel.owner

    if not manager.paystack_recipient_code:
        raise RuntimeError(
            f"Manager '{manager.username}' has no Paystack recipient code registered. "
            "Ask them to add their MoMo/bank account details."
        )

    commission = round(float(payment.amount) * COMMISSION_RATE, 2)
    payout = round(float(payment.amount) - commission, 2)
    transfer_reference = _stub_reference("tfr")

    if not PAYSTACK_SECRET:
        # Dev mode — record the intent without hitting Paystack.
        payment.platform_commission = commission
        payment.manager_payout = payout
        payment.transfer_reference = transfer_reference
        payment.transfer_code = "TRF_stub"
        payment.save(update_fields=[
            "platform_commission", "manager_payout", "transfer_reference", "transfer_code"
        ])
        return {
            "transfer_code": "TRF_stub",
            "transfer_reference": transfer_reference,
            "commission": commission,
            "payout": payout,
            "stub": True,
        }

    payload = {
        "source": "balance",
        "amount": int(payout * 100),  # pesewas
        "recipient": manager.paystack_recipient_code,
        "reference": transfer_reference,
        "reason": f"Booking #{booking.pk} payout — HostelHub Ghana",
    }

    try:
        resp = requests.post(
            f"{PAYSTACK_BASE}/transfer",
            json=payload,
            headers=_paystack_headers(),
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()["data"]

        payment.platform_commission = commission
        payment.manager_payout = payout
        payment.transfer_reference = data.get("reference", transfer_reference)
        payment.transfer_code = data.get("transfer_code", "")
        payment.save(update_fields=[
            "platform_commission", "manager_payout", "transfer_reference", "transfer_code"
        ])

        return {
            "transfer_code": payment.transfer_code,
            "transfer_reference": payment.transfer_reference,
            "commission": commission,
            "payout": payout,
        }
    except requests.HTTPError as exc:
        body = exc.response.text if exc.response else str(exc)
        logger.error("Paystack transfer failed: %s — %s", exc, body)
        raise RuntimeError(f"Paystack transfer failed: {body}") from exc
    except Exception as exc:
        logger.error("Paystack transfer error: %s", exc)
        raise RuntimeError(str(exc)) from exc


# ---------------------------------------------------------------------------
# Hubtel / Manual stubs (unchanged)
# ---------------------------------------------------------------------------

def _initiate_hubtel(payment: Payment) -> dict:
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
