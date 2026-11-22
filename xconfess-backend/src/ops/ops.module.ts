import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JourneyOperationEntity } from './entities/journey-operation.entity';
import { JourneyReliabilityService } from './journey-reliability.service';
import { OpsController } from './ops.controller';

@Module({
  imports: [TypeOrmModule.forFeature([JourneyOperationEntity])],
  controllers: [OpsController],
  providers: [JourneyReliabilityService],
  exports: [JourneyReliabilityService],
})
export class OpsModule {}
