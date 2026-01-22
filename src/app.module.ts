import { Module } from '@nestjs/common';
import { PeopleModule } from './people/people.module';
import { ConfigModule } from './config/config.module';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ConfigService } from '@nestjs/config';

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
  ],
})
export class AppModule {}
