import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsNumber, Max, Min } from 'class-validator';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JourneyReliabilityService } from './journey-reliability.service';
import { JourneyName, JourneyOutcome } from './entities/journey-operation.entity';

export class RecordJourneyOperationDto {
  @IsEnum(['publish', 'report', 'review'])
  journey: JourneyName;

  @IsEnum(['success', 'failure'])
  outcome: JourneyOutcome;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(86400000)
  latencyMs: number;
}

@ApiTags('Operations')
@Controller('ops')
export class OpsController {
  constructor(private readonly journeyReliability: JourneyReliabilityService) {}

  @Get('journey-signals')
  @ApiOperation({
    summary: 'Read bounded publish, report, and review reliability signals',
  })
  @ApiResponse({ status: 200, description: 'Privacy-safe aggregate journey signals' })
  getJourneySignals() {
    return this.journeyReliability.getSignals();
  }

  @Post('journey-signals/operations')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @ApiOperation({
    summary: 'Record an aggregate journey operation result',
  })
  @ApiResponse({ status: 202, description: 'Operation recorded' })
  @ApiResponse({ status: 400, description: 'Invalid bounded operation fields' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Admin authorization required' })
  recordOperation(@Body() dto: RecordJourneyOperationDto) {
    const signal = this.journeyReliability.recordOperation(
      dto.journey,
      dto.outcome,
      dto.latencyMs,
    );
    return {
      status: 'accepted',
      retryable: dto.outcome === 'failure',
      journey: dto.journey,
      signal,
    };
  }
}
