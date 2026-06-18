"""URL patterns for the chat API, mounted at /api/chat/."""
from django.urls import path
from .chat_views import (
    ChatRoomListView,
    ChatRoomDetailView,
    ChatMessagesView,
    MessageReactView,
    ChatUnreadCountView,
    ChatMarkReadView,
)

urlpatterns = [
    path("rooms/",                    ChatRoomListView.as_view(),    name="chat-room-list"),
    path("rooms/<int:pk>/",           ChatRoomDetailView.as_view(),  name="chat-room-detail"),
    path("rooms/<int:pk>/messages/",  ChatMessagesView.as_view(),    name="chat-messages"),
    path("rooms/<int:pk>/mark-read/", ChatMarkReadView.as_view(),    name="chat-mark-read"),
    path("messages/<int:pk>/react/",  MessageReactView.as_view(),    name="chat-react"),
    path("unread-count/",             ChatUnreadCountView.as_view(), name="chat-unread-count"),
]
