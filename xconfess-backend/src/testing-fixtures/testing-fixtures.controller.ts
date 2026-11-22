import { Body, Controller, Get, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { TestingFixtureService, TestFixtureRecord } from './testing-fixture.service';

@ApiTags('Testing Fixtures')
@ApiBearerAuth()
@Controller('admin/testing-fixtures')
@UseGuards(JwtAuthGuard, AdminGuard)
export class TestingFixturesController {
  constructor(private readonly fixtures: TestingFixtureService) {}

  @Get()
  @ApiOperation({ summary: 'List registered synthetic test fixtures' })
  @ApiResponse({ status: 200, description: 'Synthetic fixture registry returned' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Admin authorization required' })
  list() {
    return this.fixtures.list();
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @ApiOperation({ summary: 'Register or update a synthetic test fixture' })
  @ApiResponse({ status: 201, description: 'Synthetic fixture recorded' })
  @ApiResponse({ status: 400, description: 'Invalid fixture metadata' })
  register(@Body() fixture: TestFixtureRecord) {
    return this.fixtures.register(fixture);
  }
}
