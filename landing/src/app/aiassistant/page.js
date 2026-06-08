import AIAssistantClient from './aiassistant-client';

export const metadata = {
  title: "AIassistant — Smart Knowledge-Base Assistant",
  description: "Dokümanlarınızla eğitilen, markanızın ses tonuna göre özelleştirilebilen ve ödemeleri toplayabilen Ragleaf AIassistant'ı keşfedin. / Discover Ragleaf AIassistant trained on your docs, fully customizable and payment-enabled.",
};

export default function Page() {
  return <AIAssistantClient />;
}
