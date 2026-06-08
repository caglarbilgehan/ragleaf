import "./globals.css";
import { LangProvider } from "../context/LangContext";
import { AssistantProvider } from "../context/AssistantContext";
import { UIProvider } from "../context/UIContext";
import Header from "../components/Header";
import Footer from "../components/Footer";
import RagleafAssistant from "../components/RagleafAssistant";
import BodyClassHandler from "../components/BodyClassHandler";
import LoginModal from "../components/LoginModal";
import SignupModal from "../components/SignupModal";

export const metadata = {
  title: {
    default: "Ragleaf — AI Assistant & Agent Platform",
    template: "%s | Ragleaf"
  },
  description: "Ragleaf ile dokümanlarınızdan özel AI ajanlar oluşturun. WordPress eklentisi, JavaScript widget veya API ile her yere entegre edin. / Create custom AI agents from your documents. Integrate everywhere with WordPress plugin, JavaScript widget or API.",
  metadataBase: new URL("https://ragleaf.com"),
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <LangProvider>
          <AssistantProvider>
            <UIProvider>
              <BodyClassHandler />
              
              {/* Floating Mobile/Desktop Assistant Widget */}
              <RagleafAssistant />
              
              <Header />
              
              <main id="pageContent">
                {children}
              </main>
              
              <Footer />

              {/* Global Modal Dialogs */}
              <LoginModal />
              <SignupModal />
            </UIProvider>
          </AssistantProvider>
        </LangProvider>
      </body>
    </html>
  );
}
