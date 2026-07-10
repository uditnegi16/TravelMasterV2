import { LegalLayout } from "../../components/legal/LegalLayout";

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Privacy Policy"
      lastUpdated="July 10, 2026"
      intro="This policy explains what information TravelMaster collects, how it's used, and the choices you have."
      sections={[
        {
          id: "information-we-collect",
          title: "1. Information we collect",
          content: (
            <>
              <p>
                We collect information you provide directly, such as your
                name, email address, and the details of the trips you plan
                through chat or voice input.
              </p>
              <p>
                We also collect limited technical information automatically —
                device type, browser, and general usage patterns — to keep
                TravelMaster reliable and secure.
              </p>
            </>
          ),
        },
        {
          id: "how-we-use-information",
          title: "2. How we use your information",
          content: (
            <ul className="list-disc space-y-2 pl-5">
              <li>To generate and refine your trip itineraries</li>
              <li>To save your chat history so you can return to past trips</li>
              <li>To process payments for Premium features</li>
              <li>To improve the reliability and quality of our AI planning</li>
            </ul>
          ),
        },
        {
          id: "voice-data",
          title: "3. Voice input & audio",
          content: (
            <p>
              When you use voice input, audio is processed only for the
              purpose of converting speech to text. Audio is not stored after
              transcription completes.
            </p>
          ),
        },
        {
          id: "sharing",
          title: "4. How we share information",
          content: (
            <p>
              We share data with trusted service providers — such as flight
              and hotel search partners, and payment processors — only as
              needed to deliver the service. We do not sell your personal
              information.
            </p>
          ),
        },
        {
          id: "data-retention",
          title: "5. Data retention",
          content: (
            <p>
              Your chat history and trip data are retained until you delete
              them or close your account. You can delete individual trips at
              any time from the chat sidebar.
            </p>
          ),
        },
        {
          id: "your-rights",
          title: "6. Your rights",
          content: (
            <p>
              You can request access to, correction of, or deletion of your
              personal data at any time by contacting us through the{" "}
              <a href="/contact" className="font-semibold text-brand hover:underline">
                Contact page
              </a>
              .
            </p>
          ),
        },
        {
          id: "changes",
          title: "7. Changes to this policy",
          content: (
            <p>
              We may update this policy as TravelMaster evolves. Material
              changes will be reflected by an updated "Last updated" date
              above.
            </p>
          ),
        },
      ]}
    />
  );
}
