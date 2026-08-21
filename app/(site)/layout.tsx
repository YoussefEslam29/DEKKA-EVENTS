import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

/** Everything with site chrome: the public app plus the back-office tools. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
    </div>
  );
}
