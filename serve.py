import http.server, os

os.chdir("/Users/pratikpatel/Documents/GitHub/road-travel-web")
handler = http.server.SimpleHTTPRequestHandler
httpd = http.server.HTTPServer(("", 3000), handler)
httpd.serve_forever()
