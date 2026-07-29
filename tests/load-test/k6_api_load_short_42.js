import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

export const options = {
  scenarios: {
    concurrent_access: {
      executor: "constant-vus",
      vus: 42,
      duration: "20s",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.10"],
  },
};

const apiResponseTime = new Trend("api_response_time");
const apiErrorRate = new Rate("api_error_rate");
const apiCallCounter = new Counter("api_call_total");

const BASE_URL = __ENV.API_BASE_URL || "http://localhost:5000";
const JWT_TOKEN = __ENV.JWT_TOKEN || "";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${JWT_TOKEN}`,
};

function apiRequest(method, endpoint, body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const params = { headers, timeout: "10s" };
  let res;

  if (method === "GET") res = http.get(url, params);
  else if (method === "POST") res = http.post(url, body ? JSON.stringify(body) : null, params);
  else if (method === "PUT") res = http.put(url, body ? JSON.stringify(body) : null, params);

  apiCallCounter.add(1);
  apiResponseTime.add(res.timings.duration);
  // Không coi 401/403 do thiếu token là lỗi hệ thống.
  // Mục tiêu của script evidence này là đo latency/health khi load, không phải auth coverage.
  apiErrorRate.add(res.status >= 500);
  return res;
}

export default function () {
  group("Load smoke APIs", () => {
    const rootRes = apiRequest("GET", "/");
    check(rootRes, { "Root 200|401": (r) => [200, 401].includes(r.status) });

    const studentsRes = apiRequest("GET", "/api/students?page=1&limit=10");
    check(studentsRes, { "Students 200|401": (r) => [200, 401].includes(r.status) });

    const coursesRes = apiRequest("GET", "/api/courses");
    check(coursesRes, { "Courses 200|401": (r) => [200, 401].includes(r.status) });

    const schedulesRes = apiRequest("GET", "/api/schedules");
    check(schedulesRes, { "Schedules 200|401": (r) => [200, 401].includes(r.status) });

    sleep(0.3);
  });
}

