export class ControlRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ControlRequestError";
    this.status = status;
  }
}
