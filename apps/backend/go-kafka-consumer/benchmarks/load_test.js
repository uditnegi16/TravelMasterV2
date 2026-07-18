import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 100,
  duration: "30s",
};

const SESSION_ID = "41870679-e97b-4204-b828-f1e0fa58204e";

export default function () {
  const res = http.get(
    `http://localhost:8081/result/${SESSION_ID}`
  );

  check(res, {
    "status is 200": (r) => r.status === 200,
  });
}