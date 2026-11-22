export class ConfessionResponseDto {
  id: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
  isAnchored?: boolean;
  stellarTxHash?: string | null;
  stellarHash?: string | null;
  anchoredAt?: Date | null;

  constructor(partial: Partial<ConfessionResponseDto>) {
    Object.assign(this, partial);
  }
}
