import AIAutomationClient from './aiautomation-client';

export const metadata = {
  title: "AIautomation — Trigger-Based Assistant Workflows",
  description: "Ragleaf AIautomation ile asistanlarınızı tetikleyicilerle (Telegram, ziyaretçi gelmesi, özel koşullar) entegre edin ve otonom iş akışları kurun. / Integrate your assistants with triggers (Telegram, visitor landings, custom conditions) and set up autonomous workflows.",
};

export default function Page() {
  return <AIAutomationClient />;
}
