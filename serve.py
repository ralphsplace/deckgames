#!/usr/bin/env python3
"""Run the games without Docker:  python3 serve.py [port]   then open http://localhost:8080
(The bridge page uses ES modules, which browsers refuse to load from file:// - it must be served over http.)"""
import http.server, os, socketserver, sys, webbrowser

os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.mjs': 'text/javascript',
                      '.css': 'text/css', '.html': 'text/html'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

socketserver.ThreadingTCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(('', PORT), Handler) as srv:
    print(f'Deck Games on http://localhost:{PORT}  (Ctrl+C to stop)')
    webbrowser.open(f'http://localhost:{PORT}')
    try: srv.serve_forever()
    except KeyboardInterrupt: pass
