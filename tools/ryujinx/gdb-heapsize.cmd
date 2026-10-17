set pagination off
set confirm off
set architecture aarch64
target remote 127.0.0.1:55556
printf "\n=== attached; sdk_base = 0xbdd2000, arming svcSetHeapSize at 0xbe70660 ===\n"
break *0xbe70660
commands
silent
printf "\n=== svcSetHeapSize CALLED ===\n"
printf "  x0 (out pointer) = 0x%lx\n", $x0
printf "  x1 (SIZE)        = 0x%lx  (%ld bytes = %ld MB)\n", $x1, $x1, ($x1 / 1048576)
printf "  lr (caller)      = 0x%lx   sdk+0x%lx   main+0x%lx\n", $lr, ($lr - 0xbdd2000), ($lr - 0xbe40000)
printf "  sp               = 0x%lx\n", $sp
continue
end
printf "=== continuing; restart the title in Ryujinx now ===\n"
continue
