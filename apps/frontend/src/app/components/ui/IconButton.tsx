import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
};

export default function IconButton({
  icon,
  className = "",
  ...props
}: Props) {
  return (
    <button
      {...props}
      className={className}
      style={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        border: "1px solid #d1d5db",
        background: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      {icon}
    </button>
  );
}