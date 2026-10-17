set pagination off
set architecture aarch64
target remote 127.0.0.1:55556
printf "\n=== CONNECTED ===\n"
info registers pc sp lr x0 x1
printf "\n=== current instruction ===\n"
x/8i $pc
printf "\n=== scanning for MOD0 (module headers) ===\n"
# MOD0 magic is 'MOD0' = 4d 4f 44 30
find /b 0x80000000, 0x80000000 + 0x4000000, 0x4d, 0x4f, 0x44, 0x30
