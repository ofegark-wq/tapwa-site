#!/usr/bin/env python3
"""Static file server that honours HTTP Range requests.

`python3 -m http.server` ignores the Range header and answers 200 with the
whole file. Browsers then report the video as non-seekable: assigning
video.currentTime silently does nothing and the scroll hero never scrubs.
That failure looks exactly like broken JavaScript, which is why this file
exists — serve the site with THIS, not with http.server.

    python3 serve.py          # http://localhost:8000
    python3 serve.py 8765     # pick a port
"""
import http.server
import os
import re
import socketserver
import sys

RANGE_RE = re.compile(r'^bytes=(\d*)-(\d*)$')


class _Slice:
    """File wrapper that stops after `remaining` bytes, for copyfileobj."""

    def __init__(self, fh, remaining):
        self.fh = fh
        self.remaining = remaining

    def read(self, size=-1):
        if self.remaining <= 0:
            return b''
        if size is None or size < 0:
            size = self.remaining
        chunk = self.fh.read(min(size, self.remaining))
        self.remaining -= len(chunk)
        return chunk

    def close(self):
        self.fh.close()


class RangeHandler(http.server.SimpleHTTPRequestHandler):
    # Markup you edit constantly; media you seek constantly. Telling the browser
    # not to store the video makes it refetch on every seek, and the frames
    # never arrive in time to paint — so no-store is for source files only.
    NO_STORE = ('.html', '.css', '.js', '.json', '.svg')

    def end_headers(self):
        # Tell the browser seeking is available before it ever asks.
        self.send_header('Accept-Ranges', 'bytes')
        path = self.path.split('?')[0].split('#')[0].lower()
        if path.endswith('/') or path.endswith(self.NO_STORE):
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def send_head(self):
        header = self.headers.get('Range')
        if not header:
            return super().send_head()

        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()

        match = RANGE_RE.match(header.strip())
        if not match:
            return super().send_head()   # malformed; fall back to the whole file

        try:
            fh = open(path, 'rb')
        except OSError:
            self.send_error(404, 'File not found')
            return None

        size = os.fstat(fh.fileno()).st_size
        first, last = match.group(1), match.group(2)

        if first == '':                       # suffix form: last N bytes
            length = int(last or 0)
            if length == 0:
                fh.close()
                self.send_error(416, 'Requested Range Not Satisfiable')
                return None
            start, end = max(0, size - length), size - 1
        else:
            start = int(first)
            end = int(last) if last else size - 1

        end = min(end, size - 1)
        if start >= size or start > end:
            fh.close()
            self.send_response(416)
            self.send_header('Content-Range', 'bytes */%d' % size)
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None

        fh.seek(start)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
        self.send_header('Content-Length', str(end - start + 1))
        self.end_headers()
        return _Slice(fh, end - start + 1)


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    with Server(('', port), RangeHandler) as httpd:
        print('TAPWA — serving %s on http://localhost:%d  (ctrl-c to stop)'
              % (os.getcwd(), port))
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nstopped')
