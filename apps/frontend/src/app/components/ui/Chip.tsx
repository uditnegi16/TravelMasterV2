type Props = {
  label: string;
};

export default function Chip({ label }: Props) {
  return (
    <div
      style={{
        padding: "8px 14px",
        border: "1px solid #d1d5db",
        borderRadius: "999px",
        background: "white",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
}