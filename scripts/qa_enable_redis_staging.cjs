/**
 * Bật Redis staging — ủy quyền sang qa_fix_redis_url_staging.cjs
 * (script cũ ghi REDIS_URL không password → redis:down trên BT Redis).
 *
 * Usage: node scripts/qa_enable_redis_staging.cjs
 */
require('./qa_fix_redis_url_staging.cjs');
