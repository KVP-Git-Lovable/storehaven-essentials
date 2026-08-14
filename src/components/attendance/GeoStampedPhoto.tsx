import { format, parseISO } from "date-fns";

interface GeoStampedPhotoProps {
  photoUrl: string;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  timestamp?: string | null;
  className?: string;
}

/**
 * Renders an attendance photo with a GPS "geo-stamp" overlay below/over the
 * image showing the captured place name, coordinates and timestamp.
 */
export function GeoStampedPhoto({
  photoUrl,
  address,
  latitude,
  longitude,
  timestamp,
  className,
}: GeoStampedPhotoProps) {
  const lat = latitude != null ? Number(latitude) : null;
  const lng = longitude != null ? Number(longitude) : null;
  const hasCoords = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);

  let stampTime = "";
  if (timestamp) {
    try {
      stampTime = format(parseISO(timestamp), "dd/MM/yy - hh:mm a");
    } catch {
      stampTime = "";
    }
  }

  return (
    <div className={`relative overflow-hidden rounded-lg border bg-muted ${className ?? ""}`}>
      <img src={photoUrl} alt="Attendance capture" className="w-full h-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-[10px] leading-tight text-white">
        {stampTime && <div className="font-medium">{stampTime}</div>}
        {address && <div className="truncate">{address}</div>}
        {hasCoords && (
          <div className="opacity-80">
            {lat!.toFixed(6)}, {lng!.toFixed(6)}
          </div>
        )}
      </div>
    </div>
  );
}