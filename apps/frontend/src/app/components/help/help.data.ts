import type { LucideIcon } from "lucide-react";
import { Map, CreditCard, FileDown, History, Wrench } from "lucide-react";

export interface HelpCategory {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const helpCategories: HelpCategory[] = [
  { id: "planning", label: "Planning trips", icon: Map },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "pdf", label: "PDF & share", icon: FileDown },
  { id: "history", label: "Chat history", icon: History },
  { id: "troubleshooting", label: "Troubleshooting", icon: Wrench },
];

export interface HelpArticle {
  id: string;
  categoryId: string;
  question: string;
  answer: string;
}

export const helpArticles: HelpArticle[] = [
  {
    id: "plan-1",
    categoryId: "planning",
    question: "How do I start planning a trip?",
    answer:
      "Open Chat and describe your trip in plain language — destination, dates, and budget if you have them. TravelMaster will ask follow-up questions only if it needs to.",
  },
  {
    id: "plan-2",
    categoryId: "planning",
    question: "Can I change my trip after it's generated?",
    answer:
      "Yes. Keep chatting in the same thread — ask to swap a hotel, shift dates, or change the budget, and the itinerary updates in place.",
  },
  {
    id: "plan-3",
    categoryId: "planning",
    question: "Does TravelMaster book flights and hotels for me?",
    answer:
      "Not yet — TravelMaster finds and recommends real options with live pricing, and hands off to the provider for the actual booking.",
  },
  {
    id: "pay-1",
    categoryId: "payments",
    question: "What payment methods are supported?",
    answer:
      "Premium plans are processed securely through Razorpay, supporting major cards, UPI, and net banking.",
  },
  {
    id: "pay-2",
    categoryId: "payments",
    question: "Can I get a refund?",
    answer:
      "Reach out within 7 days of a Premium purchase through the Contact page and we'll take care of it.",
  },
  {
    id: "pdf-1",
    categoryId: "pdf",
    question: "How do I export my itinerary as a PDF?",
    answer:
      "Open any completed trip and select \"Export PDF\" from the trip toolbar. It downloads a clean, print-ready copy of your plan.",
  },
  {
    id: "pdf-2",
    categoryId: "pdf",
    question: "Can I share a trip with someone else?",
    answer:
      "Yes — use \"Share\" on a trip to generate a read-only link, no account required for the person you send it to.",
  },
  {
    id: "hist-1",
    categoryId: "history",
    question: "Where can I find my past trips?",
    answer:
      "All your conversations are saved automatically and listed in the sidebar of the Chat page, searchable by destination or date.",
  },
  {
    id: "hist-2",
    categoryId: "history",
    question: "Can I delete a chat?",
    answer:
      "Yes — open the chat, use the menu next to its title, and select Delete. This can't be undone.",
  },
  {
    id: "trouble-1",
    categoryId: "troubleshooting",
    question: "Voice input isn't working — what do I do?",
    answer:
      "Check that microphone access is allowed for this site in your browser settings, then tap the mic button again. If your browser doesn't support live transcription, TravelMaster automatically falls back to server-side transcription.",
  },
  {
    id: "trouble-2",
    categoryId: "troubleshooting",
    question: "The itinerary won't load. What should I try?",
    answer:
      "Refresh the page first. If it still doesn't load, check your connection — TravelMaster needs an active connection to fetch live pricing.",
  },
];
