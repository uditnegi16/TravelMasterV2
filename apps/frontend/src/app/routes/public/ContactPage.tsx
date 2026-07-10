import { ContactHero } from "../../components/contact/ContactHero";
import { ContactForm } from "../../components/contact/ContactForm";
import { ContactInfo } from "../../components/contact/ContactInfo";
import { FaqShortcut } from "../../components/contact/FaqShortcut";

export default function ContactPage() {
  return (
    <div className="bg-white">
      <ContactHero />

      <section className="mx-auto max-w-[1080px] px-4 pb-24 md:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <ContactForm
            onSubmit={async (values) => {
              const response = await fetch(
                `${import.meta.env.VITE_API_BASE}/contact`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(values),
                }
              );

              if (!response.ok) {
                throw new Error("Failed to submit contact form.");
              }
            }}
          />

          <div className="flex flex-col gap-6">
            <ContactInfo />
            <FaqShortcut />
          </div>
        </div>
      </section>
    </div>
  );
}
