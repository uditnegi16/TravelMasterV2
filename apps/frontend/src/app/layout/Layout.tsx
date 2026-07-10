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
      <Header />

      <main className="flex-1 overflow-hidden">
        {children}
      </main>

      {!isChatPage && <Footer />}
    </div>
  );
}