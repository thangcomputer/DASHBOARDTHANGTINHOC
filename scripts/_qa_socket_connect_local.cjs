/**
 * Socket.IO connect smoke (evidence for QA report).
 * Connects with a minted JWT using existing seeded QA student.
 *
 * Run: node scripts/_qa_socket_connect_local.cjs
 */
require("dotenv").config();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { io } = require("socket.io-client");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Student = require("../models/Student");

  const student = await Student.findOne({ name: { $regex: "^QA " } })
    .select("_id role branchId")
    .lean();

  if (!student) {
    console.log(JSON.stringify({ ok: false, reason: "No QA student found" }, null, 2));
    process.exit(0);
  }

  const token = jwt.sign(
    {
      id: String(student._id),
      role: "student",
      name: "QA student",
      branchId: student.branchId ? String(student.branchId) : null,
      permissions: [],
      aud: "student",
    },
    process.env.JWT_SECRET,
    { expiresIn: "10m" },
  );

  const socket = io(process.env.API_ORIGIN || "http://127.0.0.1:5000", {
    auth: { token },
    transports: ["websocket"],
    reconnection: false,
    timeout: 10000,
  });

  const result = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.close();
      resolve({ ok: false, reason: "timeout" });
    }, 9000);

    socket.on("connect", () => {
      clearTimeout(timer);
      // Attempt register if server expects it (legacy pattern).
      try { socket.emit("register", {}); } catch {}
      socket.close();
      resolve({ ok: true, socketId: socket.id });
    });
    socket.on("connect_error", (err) => {
      clearTimeout(timer);
      socket.close();
      resolve({ ok: false, reason: err.message });
    });
  });

  await mongoose.disconnect();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

