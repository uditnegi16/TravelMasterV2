import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

import Header from "./Header";
import Footer from "./Footer";

type LayoutProps = {
  children: ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  const { pathname } = useLocation();

  const isChatPage = pathname === "/chat";

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Chat is a full-height app surface (Gemini/ChatGPT style):
          no site header, no footer. Every nav link and the account
          menu live inside the chat's left drawer instead. */}
      {!isChatPage && <Header />}

      <main className={isChatPage ? "flex-1 overflow-hidden" : "flex-1 overflow-hidden"}>
        {children}
      </main>

      {!isChatPage && <Footer />}
    </div>
  );
}