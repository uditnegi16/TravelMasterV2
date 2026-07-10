import { Routes, Route, Navigate } from "react-router-dom";

import Layout from "./app/layout/Layout";

import LandingPage from "./app/routes/public/LandingPage";
import ChatPage from "./app/routes/app/ChatPage";
import ShareTripPage from "./app/routes/ShareTripPage";

import AboutPage from "./app/routes/public/AboutPage";
import ContactPage from "./app/routes/public/ContactPage";
import HelpCenterPage from "./app/routes/public/HelpCenterPage";
import PricingPage from "./app/routes/public/PricingPage";
import PrivacyPolicyPage from "./app/routes/public/PrivacyPolicyPage";
import TermsPage from "./app/routes/public/TermsPage";
import NotFoundPage from "./app/routes/NotFoundPage";
import ErrorPage from "./app/routes/ErrorPage";
import OfflinePage from "./app/routes/OfflinePage";
import ProtectedRoute from "./app/layout/ProtectedRoute";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<ProtectedRoute />}>
            <Route path="/chat" element={<ChatPage />} />
          </Route>          
        </Route>

        <Route path="/plan" element={<Navigate to="/chat" replace />} />

        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/help" element={<HelpCenterPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/error" element={<ErrorPage />} />
        <Route path="/offline" element={<OfflinePage />} />

        <Route path="/share/:token" element={<ShareTripPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}
