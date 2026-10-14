export class LatestRequestSequence {
  private currentSequence = 0;

  next(): number {
    this.currentSequence += 1;
    return this.currentSequence;
  }

  isCurrent(sequence: number): boolean {
    return sequence === this.currentSequence;
  }

  invalidate(): void {
    this.currentSequence += 1;
  }
}
