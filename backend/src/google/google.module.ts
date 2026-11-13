import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import {
  GoogleController,
  GoogleAgendaLinkController,
} from './google.controller';
import { GoogleAccountService } from './google-account.service';
import { GoogleOAuthClient } from './google-oauth.client';
import { GoogleCalendarClient } from './google-calendar.client';
import { GoogleCalendarLinkService } from './google-calendar-link.service';
import { getJwtSecret } from '../config/jwt-secret';
import { googleConfig } from './google.config';

@Module({
  imports: [
    JwtModule.register({
      secret: getJwtSecret(),
    }),
  ],
  controllers: [GoogleController, GoogleAgendaLinkController],
  providers: [
    GoogleOAuthClient,
    GoogleAccountService,
    GoogleCalendarClient,
    GoogleCalendarLinkService,
  ],
  exports: [
    GoogleOAuthClient,
    GoogleAccountService,
    GoogleCalendarClient,
    GoogleCalendarLinkService,
  ],
})
export class GoogleModule {
  constructor() {
    googleConfig();
  }
}
