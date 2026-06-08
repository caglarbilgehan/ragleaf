import AIWriterClient from './aiwriter-client';

export const metadata = {
  title: "AIwriter — Autonomous AI Content Creator",
  description: "Ragleaf AIwriter ile asistanınızın kimliği ve ses tonuyla otonom olarak her türlü yazı ve içerik üretin. / Write autonomous content, drafts, and reports with Ragleaf AIwriter matching your assistant's identity and tone of voice.",
};

export default function Page() {
  return <AIWriterClient />;
}
