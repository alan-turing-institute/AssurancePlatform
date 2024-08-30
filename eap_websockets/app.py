import logging
import urllib
import urllib.parse
from collections import defaultdict
from typing import Any, Awaitable, cast

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
    def __init__(
        self, application: Application, request: HTTPServerRequest, **kwargs: Any
    ) -> None:
        super().__init__(application, request, **kwargs)
        self.case_id: int | None = None

    def check_origin(self, origin: str) -> bool:
        allowed: bool = super().check_origin(origin)
        origin_parsed: urllib.parse.ParseResult = urllib.parse.urlparse(origin.lower())

        origins_matched: bool = any(
            origin_parsed.netloc == host for host in options.allowed_hosts
        )

        return options.debug or allowed or origins_matched

    def open(self, case_id: int):
        self.case_id = case_id
        cast(TeaPlatformApplication, self.application).add_subscriber(
            self.case_id, self
        )

    def on_message(self, message: str | bytes) -> Awaitable[None] | None:
        cast(TeaPlatformApplication, self.application).broadcast(
            message, self.case_id, sender=self
        )

    def on_close(self) -> None:
        cast(TeaPlatformApplication, self.application).remove_subscriber(
            self.case_id, self
        )


class TeaPlatformApplication(Application):
    def __init__(self, **kwargs) -> None:

        routes: list[tuple] = [(r"/(?P<case_id>[0-9]+)", AssuranceCaseHandler)]
        super().__init__(routes, **kwargs)

        self.case_subscribers: dict[int, list[AssuranceCaseHandler]] = defaultdict(list)

    def add_subscriber(
        self, case_id: int, case_handler: "AssuranceCaseHandler"
    ) -> None:
        self.case_subscribers[case_id].append(case_handler)

    def remove_subscriber(
        self, case_id: int | None, case_handler: "AssuranceCaseHandler"
    ) -> None:
        if case_id is not None:
            self.case_subscribers[case_id].remove(case_handler)

    def get_subscribers(self, case_id: int) -> list[AssuranceCaseHandler]:
        return self.case_subscribers[case_id]

    def broadcast(
        self,
        message: str | bytes,
        case_id: int | None = None,
        sender: AssuranceCaseHandler | None = None,
    ):
        if case_id is None:
            for case_id in self.case_subscribers:
                self.broadcast(message, case_id=case_id, sender=sender)
        else:
            handlers: list[AssuranceCaseHandler] = self.get_subscribers(case_id)
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
