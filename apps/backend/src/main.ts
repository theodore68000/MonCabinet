import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 🔥🔥🔥 CORS FULL DEV → autorise toutes les origines
  // (corrige 100% des "Failed to fetch" côté Next)
  app.enableCors({
    origin: (origin, callback) => {
      callback(null, true); // on autorise TOUT
    },
    methods: 'GET,POST,PATCH,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
    credentials: true,
  });

  // Stripe → raw
  app.use(
    '/webhook/stripe',
    bodyParser.raw({ type: 'application/json' }),
  );

  // Le reste → JSON
  app.use(bodyParser.json());

  // 🔥🔥🔥 PIPES DE VALIDATION → OBLIGATOIRES
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true, // ⬅⬅⬅ transforme String → Number via DTO
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  await app.listen(3001);
  console.log('🚀 Backend started on http://localhost:3001');
}

bootstrap();
