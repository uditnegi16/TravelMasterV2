import { useState } from "react";

const tabs = [
  "Summary",
  "Flights",
  "Hotels",
  "Places",
  "Weather",
];

type Props = {
  children: React.ReactNode[];
};

export default function ResponseTabs({
  children,
}: Props) {
  const [active, setActive] = useState(0);

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          marginBottom: 24,
        }}
      >
        {tabs.map((tab, index) => (
          <button
            key={tab}
            onClick={() => setActive(index)}
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              border: "none",
              background:
                active === index
                  ? "#2563eb"
                  : "#e5e7eb",
              color:
                active === index
                  ? "white"
                  : "#111827",
              cursor: "pointer",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {children[active]}
    </>
  );
}