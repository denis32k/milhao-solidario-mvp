import PixelMap from "@/components/map/PixelMap";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="h-screen w-screen overflow-hidden bg-green-100">
      <PixelMap />
    </main>
  );
}
