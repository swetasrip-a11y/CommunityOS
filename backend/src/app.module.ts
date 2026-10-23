import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AmenitiesModule } from './amenities/amenities.module';
import { CommunitiesModule } from './communities/communities.module';
import { PrismaModule } from './prisma/prisma.module';
import { RequestsModule } from './requests/requests.module';
import { VisitorsModule } from './visitors/visitors.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        const jwtSecret = config.JWT_SECRET;
        if (typeof jwtSecret !== 'string' || jwtSecret.length < 32) {
          throw new Error('JWT_SECRET must contain at least 32 characters');
        }
        return config;
      },
    }),
    PrismaModule,
    AuthModule,
    CommunitiesModule,
    RequestsModule,
    VisitorsModule,
    AmenitiesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
