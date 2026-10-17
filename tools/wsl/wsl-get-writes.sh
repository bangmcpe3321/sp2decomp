#!/usr/bin/env bash
set -uo pipefail
echo "=== all 4 writes to node->m_pNext ==="
awk '
  /^\*\*\* WRITE #/ { cap=1 }
  cap && /^#0 / { bt=1 }
  cap { print }
  bt && /^#1[01] / { cap=0; bt=0; print "" }
' /tmp/wpout.txt 2>/dev/null | head -70
