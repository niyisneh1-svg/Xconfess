import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestFixtureEntity } from './entities/test-fixture.entity';
import { TestingFixtureService } from './testing-fixture.service';
import { TestingFixturesController } from './testing-fixtures.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TestFixtureEntity])],
  controllers: [TestingFixturesController],
  providers: [TestingFixtureService],
  exports: [TestingFixtureService],
})
export class TestingFixturesModule {}
