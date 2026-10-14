export type DispatchEligibilityInput = {
  viewportWidth: number;
  finePointer: boolean;
  reducedMotion: boolean;
  saveData: boolean;
  webgl2: boolean;
};

export function isDispatchCanvasEligible(input: DispatchEligibilityInput): boolean {
  return input.viewportWidth >= 1024
    && input.finePointer
    && !input.reducedMotion
    && !input.saveData
    && input.webgl2;
}

export function browserSupportsDispatchCanvas(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const canvas = document.createElement("canvas");
  let webgl2 = false;

  try {
    const context = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    if (context) {
      webgl2 = true;
      context.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    webgl2 = false;
  }

  return isDispatchCanvasEligible({
    viewportWidth: window.innerWidth,
    finePointer: window.matchMedia("(pointer: fine)").matches,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: connection?.saveData === true,
    webgl2,
  });
}
