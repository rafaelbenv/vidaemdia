import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { getJwtSecret, isPublicExampleSecret } from './config/jwt-secret';

async function bootstrap() {
  getJwtSecret();
  if (isPublicExampleSecret()) {
    Logger.warn(
      'JWT_SECRET igual ao valor de exemplo público. Troque no .env (openssl rand -hex 32); as sessões abertas serão encerradas.',
      'Segurança',
    );
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));

  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('VidaEmDia API — Agenda com lembretes no Telegram')
    .setDescription(
      'API RESTful para o Fluxo Principal (Cadastro de Compromissos), Fluxo RBAC (Secretária ↔ Profissional), Worker de Notificações (Telegram com Retry 3x), Webhook Chatbot, Auditoria e Monitoramento.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 VidaEmDia Backend rodando em http://localhost:${port}`);
  console.log(`📚 Documentação Swagger disponível em http://localhost:${port}/api/docs`);
}

bootstrap();

