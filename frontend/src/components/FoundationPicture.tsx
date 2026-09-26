import { FOUNDATION_NAMES } from "../options";
import type { FoundationType } from "../types/foundation";

// Картинки по типам фундамента. Пока пусто: вместо картинки рисуется заглушка.
// Добавить: положить файл в frontend/public/foundations/ и вписать путь, например
// pile: "/foundations/pile.jpg".
const FOUNDATION_IMAGES: Partial<Record<FoundationType, string>> = {};

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
