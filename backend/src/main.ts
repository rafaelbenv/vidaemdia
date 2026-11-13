import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { parseCorsOrigins } from './config/cors';
import { getJwtSecret, isPublicExampleSecret } from './config/jwt-secret';
import { googleConfig } from './google/google.config';

async function bootstrap() {
  getJwtSecret();
  googleConfig(); // falha cedo se a integração com o Google estiver configurada com chave inválida
  if (isPublicExampleSecret()) {
    Logger.warn(
      'JWT_SECRET igual ao valor de exemplo público. Troque no .env (openssl rand -hex 32); as sessões abertas serão encerradas.',
      'Segurança',
    );
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));

  const origins = parseCorsOrigins(process.env.CORS_ORIGIN);
  if (origins.length === 0) {
    Logger.log('CORS desligado: só o próprio endereço chama a API.', 'Segurança');
  } else {
    app.enableCors({
      origin: origins,
      credentials: true,
    });
    Logger.log(`CORS habilitado para: ${origins.join(', ')}`, 'Segurança');
  }

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

