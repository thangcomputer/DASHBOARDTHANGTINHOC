# QA Socket Matrix Report

**Date:** 2026-07-29T06:34:24.964Z
**API:** http://127.0.0.1:5000
**Adapter hint:** redis=disabled
**Result:** 7 PASS / 0 FAIL (excl. summary row duplicate)

| ID | Name | Result | Actual |
|----|------|--------|--------|
| SOCK-00 | API healthz reachable | PASS | status=200 redis=disabled |
| SOCK-01a | Connect + register | PASS | id=cSllTZFjrlozdQkNAAAB |
| SOCK-01b | Client can attach multiple listeners without crash | PASS | dupProbe=0 |
| SOCK-01c | Disconnect → offline | PASS | was=cSllTZFjrlozdQkNAAAB connected=false |
| SOCK-01d | Reconnect with same JWT | PASS | old=cSllTZFjrlozdQkNAAAB new=QRhWHFUdWY45O4KvAAAD |
| SOCK-01e | Reject connection without token | PASS | connected=false |
| SOCK-01f | Two sockets same user both online | PASS | s2=QRhWHFUdWY45O4KvAAAD s3=X2qi7vQxwNBwzQrvAAAH |
| SOCK-01 | Realtime reconnect/offline/duplicate matrix (summary) | PASS | 7 pass / 0 fail |
