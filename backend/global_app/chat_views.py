"""Chat API views — group rooms, messages, reactions, unread count."""
import logging

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ChatRoom, ChatMembership, ChatMessage, MessageReaction
from .serializers import ChatRoomSerializer, ChatMessageSerializer

logger = logging.getLogger("global_app.chat")

ALLOWED_EMOJIS = {"👍", "❤️", "😂", "😮", "😢", "👏", "🔥", "✅"}


def _get_room_and_membership(pk, user):
    room = get_object_or_404(ChatRoom, pk=pk)
    membership = ChatMembership.objects.filter(room=room, user=user, is_active=True).first()
    if not membership:
        raise PermissionDenied("You are not an active member of this group.")
    return room, membership


class ChatRoomListView(APIView):
    """GET /api/chat/rooms/ — list the current user's active chat rooms."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rooms = (
            ChatRoom.objects
            .filter(memberships__user=request.user, memberships__is_active=True)
            .select_related("hostel")
            .prefetch_related("memberships__user", "messages__author")
            .distinct()
        )
        serializer = ChatRoomSerializer(rooms, many=True, context={"request": request})
        return Response(serializer.data)


class ChatRoomDetailView(APIView):
    """GET /api/chat/rooms/<pk>/ — room detail + full member list."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        room, _ = _get_room_and_membership(pk, request.user)
        serializer = ChatRoomSerializer(
            room.prefetch_related_objects_cache() if hasattr(room, 'prefetch_related_objects_cache') else room,
            context={"request": request},
        )
        return Response(ChatRoomSerializer(room, context={"request": request}).data)


class ChatMessagesView(APIView):
    """
    GET  /api/chat/rooms/<pk>/messages/ — list messages (cursor paginated, newest first).
    POST /api/chat/rooms/<pk>/messages/ — send a new message.

    GET params: ?before=<message_id>&limit=<n> (default 30, max 50)
    Client reverses the GET result for newest-at-bottom display.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        room, _ = _get_room_and_membership(pk, request.user)
        limit = min(int(request.query_params.get("limit", 30)), 50)
        before_id = request.query_params.get("before")

        qs = ChatMessage.objects.filter(room=room).select_related(
            "author", "reply_to__author"
        ).prefetch_related("reactions").order_by("-created_at")

        if before_id:
            try:
                qs = qs.filter(pk__lt=int(before_id))
            except (ValueError, TypeError):
                pass

        return Response(
            ChatMessageSerializer(list(qs[:limit]), many=True, context={"request": request}).data
        )

    def post(self, request, pk):
        room, membership = _get_room_and_membership(pk, request.user)
        body = request.data.get("body", "").strip()
        if not body:
            return Response({"detail": "body is required."}, status=400)

        reply_to_id = request.data.get("reply_to")
        reply_to = None
        if reply_to_id:
            reply_to = ChatMessage.objects.filter(pk=reply_to_id, room=room).first()
            if not reply_to:
                return Response({"detail": "reply_to message not found in this room."}, status=400)

        message = ChatMessage.objects.create(
            room=room,
            author=request.user,
            body=body,
            reply_to=reply_to,
        )
        membership.last_read_at = timezone.now()
        membership.save(update_fields=["last_read_at"])

        return Response(
            ChatMessageSerializer(message, context={"request": request}).data,
            status=201,
        )


class MessageReactView(APIView):
    """
    POST /api/chat/messages/<pk>/react/
    Body: { emoji: "👍" }
    Toggles the reaction — creates if absent, deletes if present.
    Returns updated reactions summary for the message.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        message = get_object_or_404(ChatMessage, pk=pk)
        _get_room_and_membership(message.room_id, request.user)

        emoji = request.data.get("emoji", "").strip()
        if not emoji:
            return Response({"detail": "emoji is required."}, status=400)

        existing = MessageReaction.objects.filter(
            message=message, user=request.user, emoji=emoji
        ).first()
        if existing:
            existing.delete()
        else:
            MessageReaction.objects.create(message=message, user=request.user, emoji=emoji)

        from django.db.models import Count
        agg = (
            MessageReaction.objects.filter(message=message)
            .values("emoji")
            .annotate(count=Count("id"))
        )
        my_emojis = set(
            MessageReaction.objects.filter(message=message, user=request.user)
            .values_list("emoji", flat=True)
        )
        reactions = [
            {"emoji": row["emoji"], "count": row["count"], "reacted": row["emoji"] in my_emojis}
            for row in agg
        ]
        return Response({"reactions": reactions})


class ChatUnreadCountView(APIView):
    """GET /api/chat/unread-count/ — number of rooms with unread messages."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        memberships = ChatMembership.objects.filter(
            user=request.user, is_active=True
        ).select_related("room")
        count = 0
        for m in memberships:
            if m.last_read_at is None:
                if m.room.messages.exists():
                    count += 1
            else:
                if m.room.messages.filter(created_at__gt=m.last_read_at).exists():
                    count += 1
        return Response({"count": count})


class ChatMarkReadView(APIView):
    """POST /api/chat/rooms/<pk>/mark-read/ — update the user's read watermark."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        _, membership = _get_room_and_membership(pk, request.user)
        membership.last_read_at = timezone.now()
        membership.save(update_fields=["last_read_at"])
        return Response({"ok": True})
