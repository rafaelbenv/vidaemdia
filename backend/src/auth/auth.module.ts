import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { getJwtSecret } from '../config/jwt-secret';
import { TelegramModule } from '../telegram/telegram.module';
import { GoogleModule } from '../google/google.module';
import { PasswordResetService } from './password-reset.service';
import { AccountDeletionService } from './account-deletion.service';

@Module({
  imports: [
    PassportModule,
    MonitoringModule,
    TelegramModule,
    GoogleModule,
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as any },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    PasswordResetService,
    AccountDeletionService,
  ],
  exports: [AuthService, PasswordResetService, AccountDeletionService],
})
export class AuthModule {}


