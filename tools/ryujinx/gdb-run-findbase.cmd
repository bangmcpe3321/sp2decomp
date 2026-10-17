set pagination off
set confirm off
set architecture aarch64
target remote 127.0.0.1:55556
printf "\n=== attached, PC = 0x%lx ===\n", $pc
source /mnt/c/Users/Hexa/Documents/nintendo/re-work/gdb-findbase.py
