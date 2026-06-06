import BlogClient from './blog-client';

export const metadata = {
  title: "Blog — Ragleaf",
  description: "Yapay zeka, Retrieval-Augmented Generation (RAG) teknolojileri ve akıllı asistanlar hakkında teknik yazılar. / Technical articles and guides on AI and RAG technologies.",
};

export default function Page() {
  return <BlogClient />;
}
