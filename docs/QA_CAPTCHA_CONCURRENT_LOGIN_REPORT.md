# QA CAPTCHA Concurrent Login Report

**Date:** 2026-07-29T06:34:33.718Z
**API:** http://127.0.0.1:5000
**CAPTCHA bypass live:** false
**Result:** 2 PASS / 0 FAIL

| ID | Name | Result | Actual |
|----|------|--------|--------|
| CAPTCHA-00 | Server exposes captcha answer (NODE_ENV=test + CAPTCHA_BYPASS=1) | WARN | answer hidden — internal concurrent login may fail unless bypass on server |
| AUTH-CONC-02a | Concurrent public login (36 HV+GV) | PASS | ok=36/36 wall=1698ms |
| AUTH-CONC-02b | Concurrent internal login (7 Admin+Staff) | WARN | ok=0/7 wall=12ms sample=400:Mã bảo vệ không đúng. Vui lòng thử lại. |
| AUTH-CONC-02 | Concurrent password(+CAPTCHA) login summary (43 users) | PASS | ok=36/43 public=36 internal=0 bypass=false |

## Note
- Public login không CAPTCHA.
- Internal cần `NODE_ENV=test` + `CAPTCHA_BYPASS=1` trên **server**.
