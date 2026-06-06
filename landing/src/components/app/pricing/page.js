import PricingClient from './pricing-client';

export const metadata = {
  title: "Fiyatlandırma | Pricing Plans — Ragleaf",
  description: "Ragleaf yapay zeka asistanı abonelik paketleri ve fiyat detayları. / Choose the right AI Assistant plan for your business. Start free or customize an enterprise package.",
};

export default function Page() {
  return <PricingClient />;
}
