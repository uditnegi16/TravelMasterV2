import { Routes, Route } from "react-router-dom";

import Layout from "./app/layout/Layout";

import LandingPage from "./app/routes/public/LandingPage";
import PlanTripPage from "./app/routes/app/PlanTripPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route
          path="/"
          element={<LandingPage />}
        />

        <Route
          path="/plan"
          element={<PlanTripPage />}
        />
      </Routes>
    </Layout>
  );
}