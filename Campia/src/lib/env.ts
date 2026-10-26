export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const paymentProvider = (): 'mock' | 'asaas' => (process.env.PAYMENT_PROVIDER === 'asaas' ? 'asaas' : 'mock');
