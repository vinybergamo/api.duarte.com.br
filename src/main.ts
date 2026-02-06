import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  ClassSerializerInterceptor,
  ConsoleLogger,
  Logger,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import cookieParser from 'cookie-parser';
import { AxiosExceptionFilter } from './helpers/filters/axios-error.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({
      prefix: 'Duarte',
    }),
  });
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3333);
  const reflector = app.get(Reflector);
  const appUrl = config.get<string | undefined>('APP_URL')?.split(/[,;]/);
  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  app.use(cookieParser());

  const corsOrigins = config
    .get<string>('CORS_ORIGIN', 'http://localhost:3000')
    .split(/[,;\s]/)
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(reflector, {
      excludePrefixes: ['_'],
    }),
  );

  const documentBuilder = new DocumentBuilder()
    .setTitle('Duarte API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .setContact(
      'Vinycios Cavalcante Bergamo',
      'vinybergamo.com',
      'contato@vinybergamo.com',
    )
    .addServer(`http://localhost:${port}`, 'Local server')
    .addServer('https://stage.api.duarte.com.br', 'Staging server')
    .addServer('https://api.duarte.com.br', 'Production server')
    .addSecurity('cookie', {
      type: 'apiKey',
      in: 'header',
      name: 'Cookie',
    });

  if (appUrl && appUrl.length > 0) {
    appUrl.forEach((url) => {
      if (url && url.trim()) {
        documentBuilder.addServer(url.trim());
      }
    });
  }

  app.useGlobalFilters(new AxiosExceptionFilter());

  const documentConfig = documentBuilder.build();
  const documentFactory = () =>
    SwaggerModule.createDocument(app, documentConfig);
  SwaggerModule.setup('swagger', app, documentFactory, {
    raw: true,
    explorer: true,
  });
  app.use(
    '/docs',
    apiReference({
      content: documentFactory,
      title: 'Duarte API',
      servers: documentConfig.servers,
      pageTitle: 'Duarte API Reference',
      theme: 'kepler',
      customCss: 'a[href="https://www.scalar.com"] { display: none }',
      // @ts-ignore
      showToolbar: 'never',
      orderSchemaPropertiesBy: 'preserve',
      orderRequiredPropertiesFirst: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
      defaultHttpClient: {
        targetKey: 'node',
        clientKey: 'axios',
      },
      persistAuth: true,
    }),
  );

  await app.listen(port, () => {
    logger.log(`Configuring CORS with origins: ${corsOrigins.join(', ')}`);
    logger.log(`Application is running on: http://localhost:${port}/api`);
    logger.log(`Swagger is running on: http://localhost:${port}/swagger`);
    logger.log(`Docs is running on: http://localhost:${port}/docs`);

    if (nodeEnv !== 'production') {
      logger.warn(`Running in ${nodeEnv} mode`);
    }

    corsOrigins.forEach((origin) => {
      logger.log(`Allowed CORS origin: ${origin}`);
    });
  });
  logger.log(`APP_ENV: ${config.get<string>('APP_ENV')}`);
  logger.log('Bootstrap completed');
}

void bootstrap();
