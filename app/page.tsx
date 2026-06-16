import StickyHeader from "@/components/layout/StickyHeader";
import PixelMap from "@/components/map/PixelMap";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="h-screen overflow-hidden bg-slate-100">
      <StickyHeader />
      <section className="h-screen pt-16">
        <PixelMap />
      </section>
    </main>
  );
}
