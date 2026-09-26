import { FOUNDATION_NAMES } from "../options";
import type { FoundationType } from "../types/foundation";

// Картинки по типам фундамента лежат в frontend/public/foundations/.
const FOUNDATION_IMAGES: Partial<Record<FoundationType, string>> = {
  strip: "/foundations/strip.jpg",
  slab: "/foundations/slab.jpg",
  pile: "/foundations/pile.jpg",
  column: "/foundations/column.jpg",
};

export function FoundationPicture({ type, className = "" }: { type: FoundationType; className?: string }) {
  const src = FOUNDATION_IMAGES[type];
  const name = FOUNDATION_NAMES[type];
  if (src) {
    return <img src={src} alt={name} className={`picture object-cover ${className}`} />;
  }
  return (
    <div className={`picture picture-empty ${className}`} role="img" aria-label={`Место для изображения: ${name.toLowerCase()}`}>
      <span className="mono">Изображение появится позже</span>
    </div>
  );
}
