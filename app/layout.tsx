import type { ReactNode } from "react";

export const metadata = {
  title: "OutboundEngine",
  description: "Personalized multi-step outbound, grounded and measured.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          margin: 0,
          background: "#0b0d12",
          color: "#e6e8ee",
        }}
      >
        {children}
      </body>
    </html>
  );
}
