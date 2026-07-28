#!/usr/bin/env python3

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoStoreRequestHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        # A local source tree can change without its URL changing. Ignore
        # conditional cache validators so every response contains current bytes.
        if "If-Modified-Since" in self.headers:
            del self.headers["If-Modified-Since"]
        return super().send_head()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description="Serve Astral Heresy without browser caching.")
    parser.add_argument("port", nargs="?", type=int, default=7666)
    parser.add_argument("--directory", default=".")
    args = parser.parse_args()

    handler = partial(NoStoreRequestHandler, directory=args.directory)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
