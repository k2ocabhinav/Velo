export interface Coordinate {
  lat: number;
  lng: number;
}

export function decodePolyline(encoded: string, precision = 5): Coordinate[] {
  if (!encoded) {
    throw new TypeError("Encoded polyline must not be empty");
  }
  if (!Number.isInteger(precision) || precision < 0 || precision > 7) {
    throw new RangeError("Polyline precision must be an integer from 0 to 7");
  }

  const coordinates: Coordinate[] = [];
  const factor = 10 ** precision;
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    const latitudeDelta = decodeValue(encoded, index);
    index = latitudeDelta.nextIndex;
    const longitudeDelta = decodeValue(encoded, index);
    index = longitudeDelta.nextIndex;
    latitude += latitudeDelta.value;
    longitude += longitudeDelta.value;
    const point = { lat: latitude / factor, lng: longitude / factor };
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) || Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) {
      throw new TypeError("Polyline contains an invalid coordinate");
    }
    coordinates.push(point);
  }
  return coordinates;
}

function decodeValue(encoded: string, startIndex: number): { value: number; nextIndex: number } {
  let result = 0;
  let shift = 0;
  let index = startIndex;
  let continuation: boolean;
  do {
    if (index >= encoded.length) {
      throw new TypeError("Encoded polyline ended before a coordinate was complete");
    }
    const chunk = encoded.charCodeAt(index) - 63;
    if (chunk < 0 || chunk > 63) {
      throw new TypeError("Encoded polyline contains an invalid character");
    }
    index += 1;
    result += (chunk & 0x1f) * 2 ** shift;
    continuation = chunk >= 0x20;
    shift += 5;
    if (continuation && shift > 30) {
      throw new TypeError("Encoded polyline value is too large");
    }
  } while (continuation);
  const value = result % 2 === 1 ? -(Math.floor(result / 2) + 1) : result / 2;
  return { value, nextIndex: index };
}
