import StickyHeader from "@/components/layout/StickyHeader";
import PixelMap from "@/components/map/PixelMap";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="h-[100dvh] overflow-hidden bg-slate-950 pt-16">
      <StickyHeader />
      <section id="mural" className="h-full">
        <PixelMap />
      </section>
    </main>
  );
}
