# import json
# import logging
# import urllib
# import urllib.parse
# from collections import defaultdict
# from typing import Any, Awaitable, Union, List, cast

# from tornado.httpserver import HTTPServer
# from tornado.httputil import HTTPServerRequest
# from tornado.ioloop import IOLoop
# from tornado.options import define, options, parse_command_line
# from tornado.web import Application
# from tornado.websocket import WebSocketClosedError, WebSocketHandler
# from tornado.web import RequestHandler

# define("debug", default=False, type=bool)
# define("port", default=8080, type=int)
# define("allowed_hosts", default="localhost:8080", multiple=True)

# # class AssuranceCaseHandler(WebSocketHandler):
# #     def __init__(
# #         self, application: Application, request: HTTPServerRequest, **kwargs: Any
# #     ) -> None:
# #         super().__init__(application, request, **kwargs)
# #         self.case_id: Union[int, None] = None
# #         self.user_id: str = self.request.remote_ip  # Simple user identification by IP

# #     # Allow all origins, or customize for specific domains
# #     def check_origin(self, origin: str) -> bool:
# #         return True  # Allow all origins

# #     def open(self, case_id: int):
# #         self.case_id = case_id
# #         app = cast(TeaPlatformApplication, self.application)
# #         app.add_subscriber(self.case_id, self)

# #         # Notify other users that a new user has joined
# #         # join_message = f"User {self.user_id} has joined case {self.case_id}."
# #         # app.broadcast(join_message, self.case_id)

# #         # Notify other users that a new user has joined
# #         self.broadcast_user_list()

# #     def on_message(self, message: Union[str, bytes]) -> Union[Awaitable[None], None]:
# #         # app = cast(TeaPlatformApplication, self.application)
# #         # app.broadcast(message, self.case_id, sender=self)
# #         pass

# #     def on_close(self) -> None:
# #         app = cast(TeaPlatformApplication, self.application)
# #         app.remove_subscriber(self.case_id, self)

# #         # Notify other users that a user has left
# #         self.broadcast_user_list()
    
# #     def broadcast_user_list(self):
# #         app = cast(TeaPlatformApplication, self.application)
# #         current_users = app.get_current_users(self.case_id)
# #         message = json.dumps(current_users)
# #         app.broadcast(message, self.case_id)
# class AssuranceCaseHandler(WebSocketHandler):
#     def __init__(self, application: Application, request: HTTPServerRequest, **kwargs: Any) -> None:
#         super().__init__(application, request, **kwargs)
#         self.case_id: Union[int, None] = None
#         self.user_id: str = ''  # Simple user identification by IP
#         self.user_name: str = ''  # User name

#     def check_origin(self, origin: str) -> bool:
#         return True  # Allow all origins

#     def open(self, case_id: int):
#         self.case_id = case_id
#         app = cast(TeaPlatformApplication, self.application)
#         app.add_subscriber(self.case_id, self)

#         # Notify other users that a new user has joined
#         self.broadcast_user_list()

#     def on_message(self, message: Union[str, bytes]) -> Union[Awaitable[None], None]:
#         try:
#             data = json.loads(message)
#             if data.get('type') == 'join':
#                 user = data.get('user', {})
#                 self.user_id = user.get('id', self.user_id)
#                 self.user_name = user.get('name', self.user_name)
#                 self.broadcast_user_list()
#         except json.JSONDecodeError:
#             logging.error('Failed to decode JSON message.')

#     def on_close(self) -> None:
#         app = cast(TeaPlatformApplication, self.application)
#         app.remove_subscriber(self.case_id, self)

#         # Notify other users that a user has left
#         self.broadcast_user_list()

#     def broadcast_user_list(self):
#         app = cast(TeaPlatformApplication, self.application)
#         current_users = app.get_current_users(self.case_id)
#         message = json.dumps(current_users)
#         app.broadcast(message, self.case_id)

# class TeaPlatformApplication(Application):
#     def __init__(self, **kwargs) -> None:
#         routes: List[tuple] = [(r"/(?P<case_id>[0-9]+)", AssuranceCaseHandler)]
#         super().__init__(routes, **kwargs)

#         self.case_subscribers: dict[int, List[AssuranceCaseHandler]] = defaultdict(list)

#     def add_subscriber(
#         self, case_id: int, case_handler: "AssuranceCaseHandler"
#     ) -> None:
#         self.case_subscribers[case_id].append(case_handler)

#     def remove_subscriber(
#         self, case_id: Union[int, None], case_handler: "AssuranceCaseHandler"
#     ) -> None:
#         if case_id is not None:
#             self.case_subscribers[case_id].remove(case_handler)

#     def get_subscribers(self, case_id: int) -> List[AssuranceCaseHandler]:
#         return self.case_subscribers[case_id]

#     def get_current_users(self, case_id: int) -> List[str]:
#         """Return the list of user_ids currently connected to the given case_id."""
#         return [handler.user_id for handler in self.case_subscribers.get(case_id, [])]

#     def broadcast(
#         self,
#         message: Union[str, bytes],
#         case_id: Union[int, None] = None,
#         sender: Union[AssuranceCaseHandler, None] = None,
#     ):
#         if case_id is None:
#             for case_id in self.case_subscribers:
#                 self.broadcast(message, case_id=case_id, sender=sender)
#         else:
#             handlers: List[AssuranceCaseHandler] = self.get_subscribers(case_id)
#             for case_handler in handlers:
#                 if case_handler != sender:
#                     try:
#                         case_handler.write_message(message)
#                     except WebSocketClosedError:
#                         self.remove_subscriber(case_id, case_handler)


# def main() -> None:
#     parse_command_line()
#     application: TeaPlatformApplication = TeaPlatformApplication(debug=options.debug)
#     server: HTTPServer = HTTPServer(application)
#     server.listen(options.port)

#     logging.info(
#         "Starting server at port %s. Allowed hosts: %s (debug: %s)",
#         options.port,
#         options.allowed_hosts,
#         options.debug,
#     )

#     IOLoop.current().start()


# if __name__ == "__main__":
#     main()


import json
import logging
import urllib
from collections import defaultdict
from typing import Any, Awaitable, Union, List, cast

from tornado.httpserver import HTTPServer
from tornado.httputil import HTTPServerRequest
from tornado.ioloop import IOLoop
from tornado.options import define, options, parse_command_line
from tornado.web import Application
from tornado.websocket import WebSocketClosedError, WebSocketHandler

define("debug", default=False, type=bool)
define("port", default=8080, type=int)
define("allowed_hosts", default="localhost:8080", multiple=True)

class AssuranceCaseHandler(WebSocketHandler):
    def __init__(self, application: Application, request: HTTPServerRequest, **kwargs: Any) -> None:
        super().__init__(application, request, **kwargs)
        self.case_id: Union[int, None] = None
        self.user_id: str = self.request.remote_ip
        self.user_name: str = ''

    def check_origin(self, origin: str) -> bool:
        return True

    def open(self, case_id: int):
        self.case_id = case_id
        app = cast(TeaPlatformApplication, self.application)
        app.add_subscriber(self.case_id, self)

        # Notify other users and send the current user list
        self.write_message(json.dumps(app.get_current_users(self.case_id)))

    def on_message(self, message: Union[str, bytes]) -> Union[Awaitable[None], None]:
        try:
            data = json.loads(message)
            if 'user_id' in data and 'user_name' in data:
                self.user_id = data['user_id']
                self.user_name = data['user_name']
                # Broadcast updated user list to all users
                app = cast(TeaPlatformApplication, self.application)
                app.broadcast(json.dumps(app.get_current_users(self.case_id)), self.case_id)
        except json.JSONDecodeError:
            self.write_message("Error: Invalid message format.")

    def on_close(self) -> None:
        app = cast(TeaPlatformApplication, self.application)
        app.remove_subscriber(self.case_id, self)
        # Broadcast updated user list to all users
        app.broadcast(json.dumps(app.get_current_users(self.case_id)), self.case_id)

    def broadcast_user_list(self):
        app = cast(TeaPlatformApplication, self.application)
        current_users = app.get_current_users(self.case_id)
        message = json.dumps(current_users)
        app.broadcast(message, self.case_id)

class TeaPlatformApplication(Application):
    def __init__(self, **kwargs) -> None:
        routes: List[tuple] = [(r"/(?P<case_id>[0-9]+)", AssuranceCaseHandler)]
        super().__init__(routes, **kwargs)
        self.case_subscribers: dict[int, List[AssuranceCaseHandler]] = defaultdict(list)

    def add_subscriber(self, case_id: int, case_handler: "AssuranceCaseHandler") -> None:
        self.case_subscribers[case_id].append(case_handler)
        self.broadcast_user_list(case_id)

    def remove_subscriber(self, case_id: Union[int, None], case_handler: "AssuranceCaseHandler") -> None:
        if case_id is not None:
            self.case_subscribers[case_id].remove(case_handler)
            self.broadcast_user_list(case_id)

    def get_subscribers(self, case_id: int) -> List[AssuranceCaseHandler]:
        """Return the list of subscribers for a given case_id."""
        return self.case_subscribers.get(case_id, [])

    def get_current_users(self, case_id: int) -> List[dict]:
        return [{'id': handler.user_id, 'name': handler.user_name} for handler in self.case_subscribers.get(case_id, [])]

    def broadcast(self, message: Union[str, bytes], case_id: Union[int, None] = None, sender: Union[AssuranceCaseHandler, None] = None):
        if case_id is None:
            for case_id in self.case_subscribers:
                self.broadcast(message, case_id=case_id, sender=sender)
        else:
            handlers: List[AssuranceCaseHandler] = self.get_subscribers(case_id)
            for case_handler in handlers:
                if case_handler != sender:
                    try:
                        case_handler.write_message(message)
                    except WebSocketClosedError:
                        self.remove_subscriber(case_id, case_handler)

    def broadcast_user_list(self, case_id: int):
        current_users = self.get_current_users(case_id)
        message = json.dumps(current_users)
        self.broadcast(message, case_id)


def main() -> None:
    parse_command_line()
    application: TeaPlatformApplication = TeaPlatformApplication(debug=options.debug)
    server: HTTPServer = HTTPServer(application)
    server.listen(options.port)
    logging.info("Starting server at port %s. Allowed hosts: %s (debug: %s)", options.port, options.allowed_hosts, options.debug)
    IOLoop.current().start()

if __name__ == "__main__":
    main()
