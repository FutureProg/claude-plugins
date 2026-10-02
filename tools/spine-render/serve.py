import http.server, os, re, base64
R=os.path.dirname(os.path.abspath(__file__))
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s,*a,**k): super().__init__(*a,directory=R,**k)
    def do_POST(s):
        data=s.rfile.read(int(s.headers['Content-Length']))
        name=re.sub(r'[^\w./-]','',s.path.split('name=')[-1]).replace('..','')
        if s.path.startswith('/log'):
            open(os.path.join(R,'log.txt'),'ab').write(data+b'\n')
        else:
            p=os.path.join(R,'out',name); os.makedirs(os.path.dirname(p),exist_ok=True)
            open(p,'wb').write(base64.b64decode(data))
        s.send_response(200); s.end_headers(); s.wfile.write(b'ok')
    def log_message(s,*a): pass
http.server.ThreadingHTTPServer(('127.0.0.1',8766),H).serve_forever()
