#!/usr/bin/env pwsh
# Reverse bridge, Windows half.
#   connects OUT to WSL:55557   (Windows -> WSL works; WSL -> Windows does not)
#   connects OUT to 127.0.0.1:55555  (Ryujinx GDB stub)
# and pumps bytes both ways. Nothing on Windows has to accept an inbound connection.
$wslHost = if ($args.Count -ge 1) { $args[0] } else { 'localhost' }
$wslPort = 55557
$stub    = 55555

Write-Host "connecting to WSL ${wslHost}:${wslPort} ..."
$toWsl = [System.Net.Sockets.TcpClient]::new()
try { $toWsl.Connect($wslHost, $wslPort) } catch { Write-Host "WSL side failed: $($_.Exception.Message)"; exit 1 }
Write-Host "  ok"

Write-Host "connecting to stub 127.0.0.1:${stub} ..."
$toStub = [System.Net.Sockets.TcpClient]::new()
try { $toStub.Connect('127.0.0.1', $stub) } catch { Write-Host "stub side failed: $($_.Exception.Message)"; exit 1 }
Write-Host "  ok -- bridging"

$a = $toWsl.GetStream()
$b = $toStub.GetStream()
$buf = New-Object byte[] 65536

$pump = {
    param($src, $dst)
    try {
        while ($true) {
            $n = $src.Read($buf, 0, $buf.Length)
            if ($n -le 0) { break }
            $dst.Write($buf, 0, $n); $dst.Flush()
        }
    } catch { }
    try { $dst.Close() } catch { }
}

$t1 = [System.Threading.Tasks.Task]::Run([scriptblock]$pump, $a, $b)
$t2 = [System.Threading.Tasks.Task]::Run([scriptblock]$pump, $b, $a)
[System.Threading.Tasks.Task]::WaitAny($t1, $t2)
Write-Host "bridge closed"
