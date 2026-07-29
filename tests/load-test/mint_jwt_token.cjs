require("dotenv").config();
const jwt = require("jsonwebtoken");

const token = jwt.sign(
  {
    id: "admin",
    role: "admin",
    name: "Admin Test",
    adminRole: "SUPER_ADMIN",
    aud: "internal",
    permissions: [],
    branchId: null,
  },
  process.env.JWT_SECRET,
  { expiresIn: "1h" },
);

process.stdout.write(token);

