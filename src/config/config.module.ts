import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { envs } from './envs';

function getEnvFiles() {
  const systemEnv = process.env.SYSTEM_ENV ?? 'local';

  const envFiles: string[] = [];

  switch (systemEnv) {
    case 'production':
      envFiles.push('.env.production');
      break;
    case 'staging':
      envFiles.push('.env.staging');
      break;
    case 'test':
      envFiles.push('.env.test');
      break;
    case 'local':
    default:
      envFiles.push('.env.local');
      break;
  }

  return envFiles;
}

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: getEnvFiles(),
      load: [() => envs],
    }),
  ],
})
export class ConfigModule {}
