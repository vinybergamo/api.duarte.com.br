import { Module } from '@nestjs/common';
import { PeopleModule } from './people/people.module';
import { ConfigModule } from './config/config.module';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ConfigService } from '@nestjs/config';
import { CreditsModule } from './credits/credits.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    PeopleModule,
    ConfigModule,
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        url: configService.getOrThrow<string>('REDIS_URL'),
      }),
    }),
    CreditsModule,
    DatabaseModule,
  ],
})
export class AppModule {}
