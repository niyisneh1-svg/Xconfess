import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, IsString, Matches, Max, Min } from 'class-validator';
import { MAX_ANCHOR_PROOF_DEPTH } from '../anchor-inclusion-proof';

const HASH_PATTERN = /^[0-9a-fA-F]{64}$/;

export class VerifyAnchorProofDto {
  @ApiProperty({ description: '32-byte confession commitment, hex encoded' })
  @IsString()
  @Matches(HASH_PATTERN)
  commitment: string;

  @ApiProperty({ description: 'Merkle root recorded by the anchor contract' })
  @IsString()
  @Matches(HASH_PATTERN)
  root: string;

  @ApiProperty({ description: 'Zero-based leaf position in the Merkle tree', minimum: 0, maximum: 4294967295 })
  @IsInt()
  @Min(0)
  @Max(0xffff_ffff)
  leafIndex: number;

  @ApiProperty({
    description: 'Hex-encoded 32-byte sibling hashes, leaf level first',
    type: [String],
    maxItems: MAX_ANCHOR_PROOF_DEPTH,
  })
  @IsArray()
  @ArrayMaxSize(MAX_ANCHOR_PROOF_DEPTH)
  @IsString({ each: true })
  @Matches(HASH_PATTERN, { each: true })
  siblings: string[];
}
