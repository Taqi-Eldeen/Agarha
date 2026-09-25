// Public API of the notifications module.
export { NotificationsModule } from './notifications.module';
export { NotificationsService, type NotifyRequest, type Channel } from './notifications.service';
export { OtpDeliveryService, OtpDeliveryFailed } from './otp-delivery.service';
export { Outbox } from './adapters/console';
export { isQuietHours } from './quiet-hours';
export type { TemplateId } from './templates';
