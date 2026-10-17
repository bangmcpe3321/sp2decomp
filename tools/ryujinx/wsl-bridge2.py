#!/usr/bin/env python3
# Reverse bridge, WSL half -- ORDER-INDEPENDENT.
#   gdb connects to 127.0.0.1:55556
#   Windows connects OUT to 0.0.0.0:55557   (no inbound needed on Windows)
# Whichever arrives first waits for the other, then the pair is pumped both ways.
import socket, threading

GDB_PORT = 55556
WIN_PORT = 55557

ready = threading.Condition()
socks = {}

def serve(port, host, key):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind((host, port))
    s.listen(1)
    print(f"listening {host}:{port} ({key})", flush=True)
    c, a = s.accept()
    print(f"  {key} connected from {a}", flush=True)
    with ready:
        socks[key] = c
        ready.notify_all()
    return c

def pump(src, dst, tag):
    try:
        while True:
            d = src.recv(65536)
            if not d:
                break
            dst.sendall(d)
    except Exception:
        pass
    finally:
        try: dst.shutdown(socket.SHUT_WR)
        except Exception: pass
        print(f"  {tag} done", flush=True)

def main():
    tg = threading.Thread(target=serve, args=(GDB_PORT, "127.0.0.1", "gdb"), daemon=True)
    tw = threading.Thread(target=serve, args=(WIN_PORT, "0.0.0.0", "win"), daemon=True)
    tg.start(); tw.start()
    with ready:
        while not ("gdb" in socks and "win" in socks):
            ready.wait(timeout=300)
    g, w = socks["gdb"], socks["win"]
    print("pairing gdb <-> windows", flush=True)
    t1 = threading.Thread(target=pump, args=(g, w, "gdb->win"), daemon=True)
    t2 = threading.Thread(target=pump, args=(w, g, "win->gdb"), daemon=True)
    t1.start(); t2.start(); t1.join(); t2.join()
    print("bridge finished", flush=True)

main()
