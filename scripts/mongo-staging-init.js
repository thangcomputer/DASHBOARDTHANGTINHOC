// MongoDB Staging initialization script (runs inside docker-entrypoint-initdb.d)
// Tạo tài khoản quyền tối thiểu chỉ được readWrite trên dashboardthangtinhoc_staging.
const dbName = process.env.MONGO_INITDB_DATABASE || 'dashboardthangtinhoc_staging';
const appUser = process.env.STAGING_MONGO_APP_USER || 'dewskill_staging_app';
const appPwd = process.env.STAGING_MONGO_APP_PASSWORD || 'StagingAppAuth_2026_Secure';

const targetDb = db.getSiblingDB(dbName);
if (!targetDb.getUser(appUser)) {
  targetDb.createUser({
    user: appUser,
    pwd: appPwd,
    roles: [{ role: 'readWrite', db: dbName }],
  });
}
