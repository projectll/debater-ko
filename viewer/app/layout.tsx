import type { ReactNode } from "react";

export const metadata = {
  title: "Debates",
  description: "The debate viewer: transcripts, turn by turn.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
