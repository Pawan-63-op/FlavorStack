import { Layout_comp } from "@/components/Layout_comp";


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <><Layout_comp>{children}</Layout_comp></>
  );
}