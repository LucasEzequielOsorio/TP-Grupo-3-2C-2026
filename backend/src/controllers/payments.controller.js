import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';
import {
  validatePaymentId,
  validatePaymentWebhook,
} from '../middlewares/payments.middleware.js';
import { createPaymentService, paymentService } from '../services/payments.service.js';

export function createPaymentController(service = createPaymentService()) {
  const router = Router();
  const webhook = Router();
  const admin = Router();

  router.use(
    authenticate,
    rateLimit({
      windowMs: 60 * 1000,
      limit: 25,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { mensaje: 'Esperá un momento antes de volver a consultar el pago.' },
    }),
  );

  router.post('/:id/pagar', validatePaymentId, async (req, res) => {
    res.json(await service.startCheckout(req.user.id, req.paymentId));
  });

  router.post('/:id/sincronizar', validatePaymentId, async (req, res) => {
    res.json(await service.syncOrderForUser(req.user.id, req.paymentId));
  });

  router.post('/:id/cancelar', validatePaymentId, async (req, res) => {
    res.json(await service.cancelOrderPayment(req.user.id, req.paymentId));
  });

  webhook.post('/', validatePaymentWebhook(service), async (req, res) => {
    await service.enqueueWebhook(req);
    res.sendStatus(200);
  });

  admin.use(authenticate, requireAdmin);
  admin.get('/pagos-revision', async (req, res) => {
    res.json(await service.listPaymentsForReview());
  });

  return { router, webhook, admin, service };
}

export const paymentController = createPaymentController(paymentService);
export const paymentsRouter = paymentController.router;
export const paymentsWebhook = paymentController.webhook;
export const paymentsAdmin = paymentController.admin;
