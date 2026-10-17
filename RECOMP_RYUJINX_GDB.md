# Getting the ground truth: attaching GDB to Splatoon 2 running in Ryujinx

The port's remaining questions could not be answered from the port, because the port **skips** the code in
question. So we attached a debugger to the **real game running in Ryujinx** and read it instead.

This round got the connection working and validated the address arithmetic against the live guest.

---

## 1. The blocker, and the trick that defeats it

**WSL2 cannot reach a Windows service.** Confirmed, not assumed:

- Ryujinx's GDB stub listens on **`0.0.0.0:55555`** and accepts from Windows (`127.0.0.1` connects fine)
- WSL2 connecting to the Windows host (`172.17.144.1:55555`) **times out**
- A firewall rule for port 55555 (`Enabled: True, Action: Allow, Profile: Any`) **did not help**
- **Mirrored WSL networking is unavailable** — it needs Windows 11 22H2+; this host is **Windows 10 build 19044**
- No Windows-side aarch64 `gdb` exists on the machine
- Cloudflare WARP and Tailscale are both up, but WARP's route table does **not** capture the WSL subnet

**The trick — reverse the direction.** Windows *can* reach WSL. So a two-part bridge makes **Windows initiate
both connections**, and nothing on Windows ever has to accept inbound:

```
gdb (WSL)  ->  127.0.0.1:55556   [ WSL bridge ]
                                         |
                                         |  paired, bytes pumped both ways
                                         |
Windows bridge  ->  WSL:55557  (outbound)
                ->  127.0.0.1:55555  (outbound, the Ryujinx stub)
```

**No admin, no firewall rule, no mirrored networking.** This is the reusable result.

Two implementation notes that cost time:

- **`wsl -d Ubuntu -- bash -c '... &'` loses its children** when the command exits. The bridge must run as the
  foreground process of the WSL invocation.
- **PowerShell `.ps1` files are blocked** by execution policy, and `[Task]::Run([scriptblock], …)` has no such
  overload. Use **`NetworkStream.CopyToAsync`** — it works and removes the threading entirely.
- The bridge pairs **one** gdb with **one** Windows connection, so it must be restarted per debug session.

## 2. Talking to the real guest

`gdb` (Ubuntu 17.1) is **x86-64 only** — `set architecture aarch64` fails with "Undefined item". Installed
**`gdb-multiarch`**, which reports `The target architecture is set to "aarch64"` and connects.

**First successful attach** put us at:

```
pc  0xbe707ac   =>  svc #0x1c
                    ret
                    svc #0x1d
                    ret
                    svc #0x1e ...
```

**That is the SDK's SVC stub table** — the same one found statically. The port had been sitting **`0x14c` bytes
from `svcSetHeapSize`** without knowing it.

## 3. Module bases, found and verified

Scanning the live guest address space for `MOD0` headers (`main+0x8 == "MOD0"`, so `base = MOD0 - 8`) and then
**verifying each candidate** by reading `*(base + 0x9e660)` and checking for `svc #1` (`0xD4000021`):

```
--- 5 MOD0 module headers found ---
  module base 0x0bb9f000
  module base 0x0bd49000
  module base 0x0bd7b000
  module base 0x0bd8e000
  module base 0x0bdd2000   <== SDK (svc #1 verified at +0x9e660)
```

**`sdk_base = 0x0bdd2000` — confirmed two independent ways:**

| Method | Result |
|---|---|
| Stub-table arithmetic: PC `0xbe707ac` minus image offset `0x9e7ac` | `0xbdd2000` |
| MOD0 header scan + `svc #1` probe at `+0x9e660` | `0xbdd2000` |

Both agree, and the result is **page-aligned** — which is the check that makes the arithmetic trustworthy.

**`svcSetHeapSize` = `0xbe70660`.**

**And a significant secondary confirmation:** the offsets this project derived *statically* (`sdk+0x9e660`,
the stub-table layout, the one-site-per-SVC structure) **match the live module byte-for-byte**. Every offset
computed in earlier rounds is validated.

## 4. What was NOT captured

**The breakpoint on `svcSetHeapSize` never fired.** The guest was suspended at `0x949ed74` / `0x9783b60` —
**below** the module range found, i.e. in the loader rather than in `game`/`sdk` — and **restarting the title
tears down the GDB stub connection**, so "arm the breakpoint, then restart" does not work.

**Getting the window requires either:**

1. launching the title **while gdb is already connected and continuing**, so the guest is caught between
   stub-accept and the call; or
2. determining that **Ryujinx services `SetHeapSize` in its own loader** for the guest — in which case there is
   nothing to break on, and **the heap size is an emulator setting rather than a game call**. That would be an
   important finding in itself.

## 5. What this establishes

| Item | State |
|---|---|
| Ryujinx GDB stub reachable from WSL | ✅ **yes, via the reverse bridge** |
| Firewall rule needed | ❌ **no — the bridge avoids inbound entirely** |
| Mirrored WSL networking | ❌ unavailable (Windows 10) |
| `gdb-multiarch` talks to the real guest | ✅ yes |
| Module bases located | ✅ **5 found** |
| **`sdk_base`** | ✅ **`0x0bdd2000`, verified two ways** |
| **`svcSetHeapSize`** | ✅ **`0xbe70660`** |
| Static offsets match the live module | ✅ **confirmed** |
| Real heap size captured | ❌ **not yet** |
| Breakpoint hit | ❌ **not yet — timing window** |

## 6. What this does NOT establish

- **The heap size is still unknown.** This was the entire point, and it was not obtained.
- **Whether `svcSetHeapSize` is ever called in Ryujinx at all is unproven.** If Ryujinx services it in its
  loader, the game may never execute it.
- **`main`'s base was not positively identified** among the five MOD0 hits — `sdk` was identified by its stub,
  the others were not labelled.
- **`rtld`'s base was not located** either.
- **The breakpoint timing problem is unsolved.**
- **The game is not booted in the port.** Nothing is rendered. **This is not a playable game.**

## 7. Scripts produced (reusable)

| File | Purpose |
|---|---|
| `wsl-bridge2.py` | WSL half of the reverse bridge (order-independent pairing) |
| `gdb-findbase.py` | gdb-Python: scan for `MOD0`, verify the SDK by its `svc #1` stub |
| `gdb-heapsize.cmd` | arm `svcSetHeapSize`, print `x1` (size) and `lr` (caller) |
| `gdb-attach.cmd` | bare connect + register dump, for a quick look |

**The reverse-bridge technique is the transferable part here** — it makes any Windows-side debug stub
reachable from WSL2 on Windows 10 without admin rights.
