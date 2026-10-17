#!/usr/bin/env bash
set -uo pipefail
cd "$HOME/sp2port" || exit 1

echo "=== objects the link command will use (table.o only) ==="
find obj-all -name 'code_*.o' -o -name 'table.o' | grep -v _runtime | grep 'table.o' | sort

echo
echo "=== count ==="
GEN=$(find obj-all -name 'code_*.o' -o -name 'table.o' | grep -v _runtime | tr '\n' ' ')
echo "  total generated objects: $(echo "$GEN" | wc -w)"

echo
echo "=== does any table.o define nx_module_subsdk0 as a STRONG global? ==="
nm -C obj-all/subsdk0/table.o 2>/dev/null | grep 'nx_module_subsdk0'

echo
echo "=== are the const symbols emitted at all? (const has internal linkage in C++ unless extern!) ==="
nm obj-all/subsdk0/table.o 2>/dev/null | grep -c 'nx_module_subsdk0' || echo 0

echo
echo "=== RETRY the link, showing the exact command size ==="
RT=$(ls obj-all/_runtime/*.o 2>/dev/null | tr '\n' ' ')
g++ -o sp2 $GEN $RT -lm -lc -lgcc -lpthread -ldl 2>le2.txt
echo "  exit=$?"
head -6 le2.txt | sed 's/^/    /'
