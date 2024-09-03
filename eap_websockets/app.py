import logging
import urllib
import urllib.parse
from collections import defaultdict
from typing import Any, Awaitable, Union, List, cast

from tornado.httpserver import HTTPServer
from tornado.httputil import HTTPServerRequest
from tornado.ioloop import IOLoop
from tornado.options import define, options, parse_command_line
from tornado.web import Application
from tornado.websocket import WebSocketClosedError, WebSocketHandler
from tornado.web import RequestHandler

define("debug", default=False, type=bool)
define("port", default=8080, type=int)
define("allowed_hosts", default="localhost:8080", multiple=True)


# class CORSRequestHandler(RequestHandler):
#     def prepare(self):
#         # Add CORS headers
#         self.set_header("Access-Control-Allow-Origin", "*")
#         self.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
#         self.set_header("Access-Control-Allow-Headers", "Content-Type")
#         self.set_header("Access-Control-Allow-Credentials", "true")
        
#         # Handle OPTIONS request
#         if self.request.method == "OPTIONS":
#             self.set_status(204)
#             self.finish()

#     def get(self):
#         self.write("CORS headers added")

#     def post(self):
#         self.write("CORS headers added")

class AssuranceCaseHandler(WebSocketHandler):
    def __init__(
        self, application: Application, request: HTTPServerRequest, **kwargs: Any
    ) -> None:
        super().__init__(application, request, **kwargs)
        self.case_id: Union[int, None] = None

    # Allow all origins, or customize for specific domains
    def check_origin(self, origin: str) -> bool:
        # Allow all origins or specify allowed origins
        return True  # This will allow all origins; adjust as needed

    def open(self, case_id: int):
        self.case_id = case_id
        cast(TeaPlatformApplication, self.application).add_subscriber(
            self.case_id, self
        )

    def on_message(self, message: Union[str, bytes]) -> Union[Awaitable[None], None]:
        cast(TeaPlatformApplication, self.application).broadcast(
            message, self.case_id, sender=self
        )

    def on_close(self) -> None:
        cast(TeaPlatformApplication, self.application).remove_subscriber(
            self.case_id, self
        )


class TeaPlatformApplication(Application):
    def __init__(self, **kwargs) -> None:
        routes: List[tuple] = [(r"/(?P<case_id>[0-9]+)", AssuranceCaseHandler)]
        super().__init__(routes, **kwargs)

        self.case_subscribers: dict[int, List[AssuranceCaseHandler]] = defaultdict(list)

    def add_subscriber(
        self, case_id: int, case_handler: "AssuranceCaseHandler"
    ) -> None:
        self.case_subscribers[case_id].append(case_handler)

    def remove_subscriber(
        self, case_id: Union[int, None], case_handler: "AssuranceCaseHandler"
    ) -> None:
        if case_id is not None:
            self.case_subscribers[case_id].remove(case_handler)

    def get_subscribers(self, case_id: int) -> List[AssuranceCaseHandler]:
        return self.case_subscribers[case_id]

    def broadcast(
        self,
        message: Union[str, bytes],
        case_id: Union[int, None] = None,
        sender: Union[AssuranceCaseHandler, None] = None,
    ):
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


def main() -> None:
    parse_command_line()
    application: TeaPlatformApplication = TeaPlatformApplication(debug=options.debug)
    server: HTTPServer = HTTPServer(application)
    server.listen(options.port)

    logging.info(
        "Starting server at port %s. Allowed hosts: %s (debug: %s)",
        options.port,
        options.allowed_hosts,
        options.debug,
    )

    IOLoop.current().start()


if __name__ == "__main__":
    main()
