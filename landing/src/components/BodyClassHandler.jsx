"use client";

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useLang } from '../context/LangContext';

export default function BodyClassHandler() {
  const pathname = usePathname();
  const { lang } = useLang();

  useEffect(() => {
    if (lang) {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  useEffect(() => {
    const titles = {
      tr: {
        '/': 'Ragleaf — Dokümanlarınızı Yapay Zeka Gücüne Dönüştürün',
        '/pricing': 'Fiyatlandırma — Ragleaf',
        '/about': 'Hakkımızda — Ragleaf',
        '/docs': 'Dökümantasyon — Ragleaf',
        '/contact': 'İletişim — Ragleaf',
        '/legal': 'Yasal Bilgiler & Sözleşmeler — Ragleaf',
        '/blog': 'Blog — Ragleaf',
        '/blog/post': 'Blog Yazısı — Ragleaf'
      },
      en: {
        '/': 'Ragleaf — Transform Your Documents with AI',
        '/pricing': 'Pricing Plans — Ragleaf',
        '/about': 'About Us — Ragleaf',
        '/docs': 'Docs — Ragleaf',
        '/contact': 'Contact Us — Ragleaf',
        '/legal': 'Legal — Ragleaf',
        '/blog': 'Blog — Ragleaf',
        '/blog/post': 'Blog Post — Ragleaf'
      }
    };

    const descriptions = {
      tr: {
        '/': 'Ragleaf ile dokümanlarınızdan özel AI ajanlar oluşturun. WordPress eklentisi, JavaScript widget veya API ile her yere entegre edin.',
        '/pricing': 'Ragleaf yapay zeka asistanı abonelik paketleri ve fiyat detayları.',
        '/about': 'Ragleaf\'in hikayesi, teknoloji vizyonu ve yapay zeka asistanı çözümleri.',
        '/docs': 'Ragleaf Web SDK, REST API, Webhooks ve entegrasyon dokümantasyonu.',
        '/contact': 'Ragleaf ile iletişime geçin. Soru, öneri ve destek taleplerinizi form üzerinden bize iletin.',
        '/legal': 'Ragleaf kullanım şartları, gizlilik politikası, KVKK ve mesafeli satış sözleşmeleri.',
        '/blog': 'Yapay zeka, Retrieval-Augmented Generation (RAG) teknolojileri ve akıllı asistanlar hakkında teknik yazılar.',
        '/blog/post': 'Ragleaf platformu, yapay zeka entegrasyonu ve akıllı bilgi tabanı asistanı hakkında teknik detaylar.'
      },
      en: {
        '/': 'Create custom AI agents from your documents. Integrate everywhere with WordPress plugin, JavaScript widget or API.',
        '/pricing': 'Choose the right AI Assistant plan for your business. Start free or customize an enterprise package.',
        '/about': 'Learn about Ragleaf\'s story, vision, and AI assistant solutions.',
        '/docs': 'Ragleaf Web SDK, REST API, Webhooks, and integration documentation.',
        '/contact': 'Get in touch with the Ragleaf team. Send your questions, feedback and support requests.',
        '/legal': 'Ragleaf terms of service, privacy policy and legal contracts.',
        '/blog': 'Technical articles and guides on AI and RAG technologies.',
        '/blog/post': 'Technical deep-dive on the Ragleaf platform and AI agent setup.'
      }
    };

    const currentLang = lang || 'en';
    const currentPath = pathname || '/';

    let title = titles[currentLang]['/'];
    if (titles[currentLang][currentPath]) {
      title = titles[currentLang][currentPath];
    } else {
      const sortedKeys = Object.keys(titles[currentLang]).sort((a, b) => b.length - a.length);
      for (const key of sortedKeys) {
        if (key !== '/' && currentPath.startsWith(key)) {
          title = titles[currentLang][key];
          break;
        }
      }
    }

    let description = descriptions[currentLang]['/'];
    if (descriptions[currentLang][currentPath]) {
      description = descriptions[currentLang][currentPath];
    } else {
      const sortedKeys = Object.keys(descriptions[currentLang]).sort((a, b) => b.length - a.length);
      for (const key of sortedKeys) {
        if (key !== '/' && currentPath.startsWith(key)) {
          description = descriptions[currentLang][key];
          break;
        }
      }
    }

    document.title = title;

    // Update meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', description);
    }

    // Update OG & Twitter Meta Tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);
    
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', description);

    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) twitterTitle.setAttribute('content', title);

    const twitterDesc = document.querySelector('meta[name="twitter:description"]');
    if (twitterDesc) twitterDesc.setAttribute('content', description);
  }, [pathname, lang]);

  useEffect(() => {
    let className = 'sub-page';
    if (pathname === '/' || pathname === '') {
      className = 'index-page';
    } else if (pathname.startsWith('/docs')) {
      className = 'installation-page';
    } else if (pathname.startsWith('/pricing')) {
      className = 'pricing-page';
    } else if (pathname.startsWith('/blog')) {
      className = 'blog-page';
    } else if (pathname.startsWith('/about')) {
      className = 'about-page';
    } else if (pathname.startsWith('/contact')) {
      className = 'contact-page';
    } else if (pathname.startsWith('/legal')) {
      className = 'legal-page';
    }

    document.body.className = className;
  }, [pathname]);

  return null;
}
