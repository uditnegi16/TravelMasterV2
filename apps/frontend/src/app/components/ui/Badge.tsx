type Props = {
  children: React.ReactNode;
};

export default function Badge({ children }: Props) {
  return (
    <span
      style={{
        background: "#eff6ff",
        color: "#2563eb",
        padding: "4px 10px",
        borderRadius: "999px",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}