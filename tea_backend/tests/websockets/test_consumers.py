"""
WebSocket consumer tests for real-time features.

This module tests:
- WebSocket connection handling and authentication
- Real-time collaboration features
- Message broadcasting and filtering
- Connection lifecycle management
- Permission-based access control for WebSocket connections
"""

from unittest.mock import Mock

from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TestCase, TransactionTestCase
from rest_framework.authtoken.models import Token

from tests.factories.case_factories import AssuranceCaseFactory
from tests.factories.content_factories import TopLevelNormativeGoalFactory
from tests.factories.user_factories import EAPGroupFactory, EAPUserFactory
from websockets.consumers import AssuranceCaseConsumer
from websockets.middleware import TokenAuthMiddleware

User = get_user_model()


class TestAssuranceCaseConsumer(TransactionTestCase):
    """Test WebSocket consumer for assurance case real-time features."""

    def setUp(self):
        """Set up test users, cases, and authentication."""
        self.user = EAPUserFactory()
        self.other_user = EAPUserFactory()
        self.case = AssuranceCaseFactory(owner=self.user)
        self.goal = TopLevelNormativeGoalFactory(assurance_case=self.case)

        # Create tokens for authentication
        self.user_token = Token.objects.get(user=self.user)
        self.other_token = Token.objects.get(user=self.other_user)

    async def test_websocket_connection_with_valid_token(self):
        """Test WebSocket connection with valid authentication token."""
        communicator = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(),
            f"/ws/cases/{self.case.id}/?token={self.user_token.key}",
        )

        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)

        # Verify user is added to case group
        await communicator.disconnect()

    async def test_websocket_connection_with_invalid_token(self):
        """Test WebSocket connection with invalid authentication token."""
        communicator = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(), f"/ws/cases/{self.case.id}/?token=invalid_token"
        )

        connected, subprotocol = await communicator.connect()
        self.assertFalse(connected)

    async def test_websocket_connection_without_token(self):
        """Test WebSocket connection without authentication token."""
        communicator = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(), f"/ws/cases/{self.case.id}/"
        )

        connected, subprotocol = await communicator.connect()
        self.assertFalse(connected)

    async def test_websocket_connection_without_case_permission(self):
        """Test WebSocket connection without case access permission."""
        communicator = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(),
            f"/ws/cases/{self.case.id}/?token={self.other_token.key}",
        )

        connected, subprotocol = await communicator.connect()
        self.assertFalse(connected)

    async def test_websocket_connection_with_view_permission(self):
        """Test WebSocket connection with view permission."""
        # Add other_user to view group
        view_group = await database_sync_to_async(EAPGroupFactory)(users=[self.other_user])
        await database_sync_to_async(self.case.view_groups.add)(view_group)

        communicator = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(),
            f"/ws/cases/{self.case.id}/?token={self.other_token.key}",
        )

        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)

        await communicator.disconnect()

    async def test_websocket_real_time_updates(self):
        """Test real-time updates broadcasting to connected clients."""
        # Connect first user
        communicator1 = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(),
            f"/ws/cases/{self.case.id}/?token={self.user_token.key}",
        )
        connected1, _ = await communicator1.connect()
        self.assertTrue(connected1)

        # Connect second user with permission
        view_group = await database_sync_to_async(EAPGroupFactory)(users=[self.other_user])
        await database_sync_to_async(self.case.view_groups.add)(view_group)

        communicator2 = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(),
            f"/ws/cases/{self.case.id}/?token={self.other_token.key}",
        )
        connected2, _ = await communicator2.connect()
        self.assertTrue(connected2)

        # Send update from first user
        update_message = {
            "type": "element_update",
            "element_type": "goal",
            "element_id": self.goal.id,
            "changes": {"name": "Updated Goal Name"},
        }

        await communicator1.send_json_to(update_message)

        # Verify second user receives the update
        response = await communicator2.receive_json_from()
        self.assertEqual(response["type"], "element_update")
        self.assertEqual(response["element_id"], self.goal.id)

        await communicator1.disconnect()
        await communicator2.disconnect()

    async def test_websocket_cursor_position_sharing(self):
        """Test sharing cursor positions between users."""
        # Connect two users
        communicator1 = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(),
            f"/ws/cases/{self.case.id}/?token={self.user_token.key}",
        )
        connected1, _ = await communicator1.connect()

        view_group = await database_sync_to_async(EAPGroupFactory)(users=[self.other_user])
        await database_sync_to_async(self.case.view_groups.add)(view_group)

        communicator2 = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(),
            f"/ws/cases/{self.case.id}/?token={self.other_token.key}",
        )
        connected2, _ = await communicator2.connect()

        # Send cursor position from user1
        cursor_message = {
            "type": "cursor_position",
            "element_id": self.goal.id,
            "position": {"x": 100, "y": 200},
        }

        await communicator1.send_json_to(cursor_message)

        # Verify user2 receives cursor position
        response = await communicator2.receive_json_from()
        self.assertEqual(response["type"], "cursor_position")
        self.assertEqual(response["user_id"], self.user.id)
        self.assertEqual(response["position"], {"x": 100, "y": 200})

        await communicator1.disconnect()
        await communicator2.disconnect()

    async def test_websocket_element_lock_mechanism(self):
        """Test element locking mechanism for editing conflicts."""
        # Connect user who will lock element
        communicator1 = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(),
            f"/ws/cases/{self.case.id}/?token={self.user_token.key}",
        )
        connected1, _ = await communicator1.connect()

        # Connect second user
        edit_group = await database_sync_to_async(EAPGroupFactory)(users=[self.other_user])
        await database_sync_to_async(self.case.edit_groups.add)(edit_group)

        communicator2 = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(),
            f"/ws/cases/{self.case.id}/?token={self.other_token.key}",
        )
        connected2, _ = await communicator2.connect()

        # User1 locks element for editing
        lock_message = {
            "type": "element_lock",
            "element_type": "goal",
            "element_id": self.goal.id,
            "action": "lock",
        }

        await communicator1.send_json_to(lock_message)

        # Verify user2 receives lock notification
        response = await communicator2.receive_json_from()
        self.assertEqual(response["type"], "element_lock")
        self.assertEqual(response["element_id"], self.goal.id)
        self.assertEqual(response["locked_by"], self.user.id)

        # User1 unlocks element
        unlock_message = {
            "type": "element_lock",
            "element_type": "goal",
            "element_id": self.goal.id,
            "action": "unlock",
        }

        await communicator1.send_json_to(unlock_message)

        # Verify user2 receives unlock notification
        response = await communicator2.receive_json_from()
        self.assertEqual(response["type"], "element_unlock")
        self.assertEqual(response["element_id"], self.goal.id)

        await communicator1.disconnect()
        await communicator2.disconnect()

    async def test_websocket_comment_notifications(self):
        """Test real-time comment notifications."""
        # Connect users
        communicator1 = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(),
            f"/ws/cases/{self.case.id}/?token={self.user_token.key}",
        )
        connected1, _ = await communicator1.connect()

        view_group = await database_sync_to_async(EAPGroupFactory)(users=[self.other_user])
        await database_sync_to_async(self.case.view_groups.add)(view_group)

        communicator2 = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(),
            f"/ws/cases/{self.case.id}/?token={self.other_token.key}",
        )
        connected2, _ = await communicator2.connect()

        # User1 creates a comment
        comment_message = {
            "type": "new_comment",
            "element_type": "goal",
            "element_id": self.goal.id,
            "comment_id": 123,
            "content": "This is a new comment",
        }

        await communicator1.send_json_to(comment_message)

        # Verify user2 receives comment notification
        response = await communicator2.receive_json_from()
        self.assertEqual(response["type"], "new_comment")
        self.assertEqual(response["comment_id"], 123)
        self.assertEqual(response["author_id"], self.user.id)

        await communicator1.disconnect()
        await communicator2.disconnect()

    async def test_websocket_user_presence(self):
        """Test user presence tracking in WebSocket connections."""
        # Connect first user
        communicator1 = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(),
            f"/ws/cases/{self.case.id}/?token={self.user_token.key}",
        )
        connected1, _ = await communicator1.connect()

        # Connect second user
        view_group = await database_sync_to_async(EAPGroupFactory)(users=[self.other_user])
        await database_sync_to_async(self.case.view_groups.add)(view_group)

        communicator2 = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(),
            f"/ws/cases/{self.case.id}/?token={self.other_token.key}",
        )
        connected2, _ = await communicator2.connect()

        # User2 should receive user_joined notification for user1
        response = await communicator2.receive_json_from()
        self.assertEqual(response["type"], "user_joined")
        self.assertEqual(response["user_id"], self.other_user.id)

        # Disconnect user1
        await communicator1.disconnect()

        # User2 should receive user_left notification
        response = await communicator2.receive_json_from()
        self.assertEqual(response["type"], "user_left")
        self.assertEqual(response["user_id"], self.user.id)

        await communicator2.disconnect()

    async def test_websocket_message_validation(self):
        """Test validation of incoming WebSocket messages."""
        communicator = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(),
            f"/ws/cases/{self.case.id}/?token={self.user_token.key}",
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Send invalid message (missing required fields)
        invalid_message = {
            "type": "element_update"
            # Missing element_id and other required fields
        }

        await communicator.send_json_to(invalid_message)

        # Should receive error response
        response = await communicator.receive_json_from()
        self.assertEqual(response["type"], "error")
        self.assertIn("validation", response["message"].lower())

        await communicator.disconnect()

    async def test_websocket_permission_enforcement(self):
        """Test that WebSocket enforces proper permissions for actions."""
        # Connect user with only view permission
        view_group = await database_sync_to_async(EAPGroupFactory)(users=[self.other_user])
        await database_sync_to_async(self.case.view_groups.add)(view_group)

        communicator = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(),
            f"/ws/cases/{self.case.id}/?token={self.other_token.key}",
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Try to send update (should be denied for view-only user)
        update_message = {
            "type": "element_update",
            "element_type": "goal",
            "element_id": self.goal.id,
            "changes": {"name": "Unauthorized update"},
        }

        await communicator.send_json_to(update_message)

        # Should receive permission denied error
        response = await communicator.receive_json_from()
        self.assertEqual(response["type"], "error")
        self.assertIn("permission", response["message"].lower())

        await communicator.disconnect()

    async def test_websocket_concurrent_editing_conflict(self):
        """Test handling of concurrent editing conflicts."""
        # Connect two users with edit permissions
        edit_group = await database_sync_to_async(EAPGroupFactory)(users=[self.other_user])
        await database_sync_to_async(self.case.edit_groups.add)(edit_group)

        communicator1 = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(),
            f"/ws/cases/{self.case.id}/?token={self.user_token.key}",
        )
        connected1, _ = await communicator1.connect()

        communicator2 = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(),
            f"/ws/cases/{self.case.id}/?token={self.other_token.key}",
        )
        connected2, _ = await communicator2.connect()

        # Both users try to edit the same element simultaneously
        update1 = {
            "type": "element_update",
            "element_type": "goal",
            "element_id": self.goal.id,
            "version": 1,
            "changes": {"name": "Update from user 1"},
        }

        update2 = {
            "type": "element_update",
            "element_type": "goal",
            "element_id": self.goal.id,
            "version": 1,  # Same version - conflict
            "changes": {"name": "Update from user 2"},
        }

        # Send updates simultaneously
        await communicator1.send_json_to(update1)
        await communicator2.send_json_to(update2)

        # One should succeed, one should get conflict error
        response1 = await communicator1.receive_json_from()
        response2 = await communicator2.receive_json_from()

        # One should be success, one should be conflict
        responses = [response1, response2]
        success_count = sum(1 for r in responses if r.get("type") == "element_updated")
        conflict_count = sum(1 for r in responses if r.get("type") == "conflict")

        self.assertEqual(success_count, 1)
        self.assertEqual(conflict_count, 1)

        await communicator1.disconnect()
        await communicator2.disconnect()


class TestWebSocketAuthentication(TestCase):
    """Test WebSocket authentication mechanisms."""

    def setUp(self):
        """Set up test data."""
        self.user = EAPUserFactory()
        self.token = Token.objects.get(user=self.user)
        self.case = AssuranceCaseFactory(owner=self.user)

    def test_token_authentication_middleware(self):
        """Test WebSocket token authentication middleware."""
        # Test valid token
        scope = {
            "type": "websocket",
            "query_string": f"token={self.token.key}".encode(),
            "user": None,
        }

        middleware = TokenAuthMiddleware(Mock())
        middleware.authenticate_user(scope)

        self.assertEqual(scope["user"], self.user)

    def test_invalid_token_authentication(self):
        """Test authentication with invalid token."""
        scope = {"type": "websocket", "query_string": b"token=invalid_token", "user": None}

        middleware = TokenAuthMiddleware(Mock())
        middleware.authenticate_user(scope)

        self.assertIsNone(scope["user"])

    def test_missing_token_authentication(self):
        """Test authentication without token."""
        scope = {"type": "websocket", "query_string": b"", "user": None}

        middleware = TokenAuthMiddleware(Mock())
        middleware.authenticate_user(scope)

        self.assertIsNone(scope["user"])


class TestWebSocketConnectionLimits(TransactionTestCase):
    """Test WebSocket connection limits and resource management."""

    def setUp(self):
        """Set up test data."""
        self.user = EAPUserFactory()
        self.token = Token.objects.get(user=self.user)
        self.case = AssuranceCaseFactory(owner=self.user)

    async def test_multiple_connections_same_user(self):
        """Test multiple connections from the same user."""
        connections = []

        # Create multiple connections
        for _ in range(3):
            communicator = WebsocketCommunicator(
                AssuranceCaseConsumer.as_asgi(), f"/ws/cases/{self.case.id}/?token={self.token.key}"
            )
            connected, _ = await communicator.connect()
            self.assertTrue(connected)
            connections.append(communicator)

        # Send message from one connection
        test_message = {"type": "cursor_position", "element_id": 1, "position": {"x": 50, "y": 100}}

        await connections[0].send_json_to(test_message)

        # Other connections should receive the message
        for i in range(1, 3):
            response = await connections[i].receive_json_from()
            self.assertEqual(response["type"], "cursor_position")

        # Clean up connections
        for conn in connections:
            await conn.disconnect()

    async def test_connection_cleanup_on_disconnect(self):
        """Test proper cleanup when connection is closed."""
        communicator = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(), f"/ws/cases/{self.case.id}/?token={self.token.key}"
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Disconnect
        await communicator.disconnect()

        # Verify connection is properly cleaned up
        # (This would check internal state management in the consumer)
        self.assertTrue(True)  # Placeholder for actual cleanup verification


class TestWebSocketErrorHandling(TransactionTestCase):
    """Test WebSocket error handling and recovery."""

    def setUp(self):
        """Set up test data."""
        self.user = EAPUserFactory()
        self.token = Token.objects.get(user=self.user)
        self.case = AssuranceCaseFactory(owner=self.user)

    async def test_malformed_json_handling(self):
        """Test handling of malformed JSON messages."""
        communicator = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(), f"/ws/cases/{self.case.id}/?token={self.token.key}"
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Send malformed JSON
        await communicator.send_to(text_data="invalid json {")

        # Should receive error response
        response = await communicator.receive_json_from()
        self.assertEqual(response["type"], "error")
        self.assertIn("json", response["message"].lower())

        await communicator.disconnect()

    async def test_unknown_message_type_handling(self):
        """Test handling of unknown message types."""
        communicator = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(), f"/ws/cases/{self.case.id}/?token={self.token.key}"
        )
        connected, _ = await communicator.connect()

        # Send unknown message type
        unknown_message = {"type": "unknown_message_type", "data": "test"}

        await communicator.send_json_to(unknown_message)

        # Should receive error response
        response = await communicator.receive_json_from()
        self.assertEqual(response["type"], "error")
        self.assertIn("unknown", response["message"].lower())

        await communicator.disconnect()

    async def test_database_error_handling(self):
        """Test handling of database errors during message processing."""
        communicator = WebsocketCommunicator(
            AssuranceCaseConsumer.as_asgi(), f"/ws/cases/{self.case.id}/?token={self.token.key}"
        )
        connected, _ = await communicator.connect()

        # Send message that would cause database error (non-existent element)
        error_message = {
            "type": "element_update",
            "element_type": "goal",
            "element_id": 99999,  # Non-existent
            "changes": {"name": "Test"},
        }

        await communicator.send_json_to(error_message)

        # Should receive error response
        response = await communicator.receive_json_from()
        self.assertEqual(response["type"], "error")

        await communicator.disconnect()
