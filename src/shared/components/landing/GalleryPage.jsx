import { Footer } from './sections/Footer.jsx';
import { GallerySection } from './sections/GallerySection.jsx';
import { Navbar } from './sections/Navbar.jsx';

export default function GalleryPage() {
  return (
    <div className="min-h-screen bg-[#F8F5EF]">
      <Navbar />
      <main>
        <GallerySection />
      </main>
      <Footer />
    </div>
  );
}
