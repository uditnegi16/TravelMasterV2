import { LegalLayout } from "../../components/legal/LegalLayout";

export default function TermsPage() {
  return (
    <LegalLayout
      eyebrow="Legal"
      title="Terms & Conditions"
      lastUpdated="July 10, 2026"
      intro="These terms govern your use of TravelMaster. By using the service, you agree to them."
      sections={[
        {
          id: "acceptance",
          title: "1. Acceptance of terms",
          content: (
            <p>
              By accessing or using TravelMaster, you agree to be bound by
              these Terms & Conditions and our Privacy Policy. If you don't
              agree, please don't use the service.
            </p>
          ),
        },
        {
          id: "using-travelmaster",
          title: "2. Using TravelMaster",
          content: (
            <>
              <p>
                TravelMaster is an AI planning assistant. It searches real
                flight, hotel, and travel data to help you build an
                itinerary — it does not guarantee prices, availability, or
                the accuracy of third-party listings at the time of booking.
              </p>
              <p>
                You're responsible for reviewing and confirming details with
                the relevant airline, hotel, or provider before you book.
              </p>
            </>
          ),
        },
        {
          id: "accounts",
          title: "3. Accounts",
          content: (
            <p>
              You're responsible for keeping your account credentials secure
              and for all activity that happens under your account.
            </p>
          ),
        },
        {
          id: "payments",
          title: "4. Payments & Premium",
          content: (
            <p>
              Premium features, when available, are billed as described at
              checkout and processed through Razorpay. Fees are
              non-refundable except where required by law or stated
              otherwise.
            </p>
          ),
        },
        {
          id: "acceptable-use",
          title: "5. Acceptable use",
          content: (
            <ul className="list-disc space-y-2 pl-5">
              <li>Don't use TravelMaster for unlawful purposes</li>
              <li>Don't attempt to disrupt or reverse-engineer the service</li>
              <li>Don't use automated tools to scrape or overload the service</li>
            </ul>
          ),
        },
        {
          id: "disclaimers",
          title: "6. Disclaimers",
          content: (
            <p>
              TravelMaster is provided "as is." We do our best to surface
              accurate, current data, but travel pricing and availability
              change quickly and are ultimately controlled by third-party
              providers.
            </p>
          ),
        },
        {
          id: "liability",
          title: "7. Limitation of liability",
          content: (
            <p>
              To the extent permitted by law, TravelMaster is not liable for
              indirect or consequential damages arising from your use of the
              service, including issues with third-party bookings.
            </p>
          ),
        },
        {
          id: "changes",
          title: "8. Changes to these terms",
          content: (
            <p>
              We may update these terms from time to time. Continuing to use
              TravelMaster after changes take effect means you accept the
              updated terms.
            </p>
          ),
        },
      ]}
    />
  );
}
