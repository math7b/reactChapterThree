import { NextApiRequest, NextApiResponse } from "next";
import { Readable } from 'stream'
import Stripe from "stripe";
import { stripe } from "../../services/stripe";
import { saveSubscription } from "./_lib/manageSubscription";

async function buffer(readable: Readable) {
    const chunks = [];

    for await (const chunk of readable) {
        chunks.push(
            typeof chunk === "string" ? Buffer.from(chunk) : chunk
        );
    }

    return Buffer.concat(chunks);
}

export const config = {
    api: {
        bodyParses: false
    }
}
const relevantEvents = new Set([
    'checkout.session.completed'
])

export default async function webhooks(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const buf = await buffer(req)
        const secret = req.headers['stripe-signature']

        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(buf, secret, process.env.STRIPE_WEBHOOK_SECRET);
        } catch (err) {
            return res.status(400).send(`Webhook error ${err.message}`);
        }

        const { type } = event;

        if (relevantEvents.has(type)) {
            try {
                switch (type) {
                    case 'checkout.session.completed':
                        const checkoutSession = event.data.object as Stripe.Checkout.Session

                        await saveSubscription(
                            checkoutSession.subscription.toString(),
                            checkoutSession.customer.toString()
                        )
                        break;
                    default:
                        throw new Error('Unhandled event.')
                }
            } catch (err) {
                return res.json({ err: 'Webhook handle failed.' })
            }
        }

        res.json({ received: true })
    } else {
        res.setHeader('Allow', 'POST')
        res.status(405).end('method not allowed')
    }
}
// stripe listen --forward-to localhost:3000/api/webhooks
// https://stripe.com/docs/stripe-cli