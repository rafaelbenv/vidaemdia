import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Module({
  imports: [
    PassportModule,
    MonitoringModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'vidaemdia_jwt_super_secret_key_2026',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as any },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}

