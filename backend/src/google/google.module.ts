import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GoogleController } from './google.controller';
import { GoogleAccountService } from './google-account.service';
import { GoogleOAuthClient } from './google-oauth.client';
import { getJwtSecret } from '../config/jwt-secret';
import { googleConfig } from './google.config';

@Module({
  imports: [
    JwtModule.register({
      secret: getJwtSecret(),
    }),
  ],
  controllers: [GoogleController],
  providers: [GoogleOAuthClient, GoogleAccountService],
  exports: [GoogleOAuthClient, GoogleAccountService],
})
export class GoogleModule {
  constructor() {
    googleConfig();
  }
}
