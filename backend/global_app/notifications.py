from .models import Notification


def notify(recipient, notif_type, title, body="", sender=None, link=""):
    Notification.objects.create(
        recipient=recipient,
        sender=sender,
        notif_type=notif_type,
        title=title,
        body=body,
        link=link,
    )


def notify_many(recipients, notif_type, title, body="", sender=None, link=""):
    Notification.objects.bulk_create([
        Notification(
            recipient=r,
            sender=sender,
            notif_type=notif_type,
            title=title,
            body=body,
            link=link,
        )
        for r in recipients
    ])
