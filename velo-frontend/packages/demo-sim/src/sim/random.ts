export interface RandomSource {
  next(): number;
}

export class SeededRandom implements RandomSource {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 0x6d2b79f5;
  }

  next(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state / 0x1_0000_0000;
  }
}

export function integerBetween(random: RandomSource, minimum: number, maximum: number): number {
  return Math.floor(random.next() * (maximum - minimum + 1)) + minimum;
}

export function weightedChoice<T extends { weight: number }>(items: T[], random: RandomSource): T {
  if (items.length === 0 || items.some((item) => !Number.isFinite(item.weight) || item.weight <= 0)) {
    throw new RangeError("Weighted choice requires items with positive finite weights");
  }
  const totalWeight = items.reduce((total, item) => total + item.weight, 0);
  let choice = random.next() * totalWeight;
  for (const item of items) {
    choice -= item.weight;
    if (choice < 0) {
      return item;
    }
  }
  return items[items.length - 1]!;
}

export function poissonDelayMs(random: RandomSource, speedFactor: number): number {
  if (!Number.isFinite(speedFactor) || speedFactor < 1 || speedFactor > 20) {
    throw new RangeError("Speed factor must be from 1 to 20");
  }
  const sample = Math.min(1 - Number.EPSILON, Math.max(0, random.next()));
  return Math.max(15_000, -Math.log(1 - sample) * 75_000) / speedFactor;
}
