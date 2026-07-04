import { createOrder } from "../../services/api";

export default function PremiumCard() {
  async function handleUpgrade() {
    try {
      const order = await createOrder();

      const razorpay = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,

        name: "TravelMaster Premium",

        description: "Premium Subscription",

        theme: {
          color: "#2563eb",
        },

        handler: async (response) => {
          const verifyResponse = await fetch(
            "http://127.0.0.1:8000/payments/verify",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                razorpay_order_id:
                  response.razorpay_order_id,

                razorpay_payment_id:
                  response.razorpay_payment_id,

                razorpay_signature:
                  response.razorpay_signature,
              }),
            }
          );

          if (!verifyResponse.ok) {
            alert("Payment verification failed.");
            return;
          }

          alert("🎉 Premium activated successfully!");
        },
      });

      razorpay.open();
    } catch (error) {
      console.error(error);
      alert("Unable to start payment.");
    }
  }

  return (
    <div
      style={{
        border: "1px solid #dbeafe",
        borderRadius: 12,
        padding: 24,
        marginBottom: 24,
        background: "#eff6ff",
      }}
    >
      <h2>TravelMaster Premium</h2>

      <p>
        Unlimited AI trip planning, premium features and
        future upgrades.
      </p>

      <h3>₹399</h3>

      <button
        onClick={handleUpgrade}
        style={{
          padding: "12px 24px",
          cursor: "pointer",
        }}
      >
        Upgrade to Premium
      </button>
    </div>
  );
}