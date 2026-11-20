import { httpError, parseId } from '../validation.js';

export function validatePaymentId(req, res, next) {
  try {
    req.paymentId = parseId(req.params.id);
    next();
  } catch (error) {
    next(error);
  }
}

export function validatePaymentWebhook(service) {
  return (req, res, next) => {
    if (!service.validWebhookSignature(req))
      return next(httpError(401, 'Notificación no autorizada'));
    next();
  };
}
