import AIChatClient from './aichat-client';

export const metadata = {
  title: "AIchat — Live Chatbot & Simulator",
  description: "Ragleaf AIchat otonom ve özelleştirilebilir canlı sohbet deneyimini keşfedin. Sektörel asistan simülasyonunu test edin. / Explore Ragleaf AIchat autonomous live chatbot. Test sector-specific interactive simulations live.",
};

export default function Page() {
  return <AIChatClient />;
}
