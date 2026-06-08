"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useLang } from '../context/LangContext';
import { T } from '../i18n/translations';

const SECTOR_METADATA = {
  'kuafor': { tr: 'Kuaför Yapay Zeka Asistanı', en: 'Hair Salon AI Assistant', avatar: '✂️' },
  'guzellik-salonu': { tr: 'Güzellik Salonu Yapay Zeka Asistanı', en: 'Beauty Salon AI Assistant', avatar: '💅' },
  'dis-hekimi': { tr: 'Diş Hekimi Yapay Zeka Asistanı', en: 'Dentist AI Assistant', avatar: '🦷' },
  'restoran': { tr: 'Restoran Yapay Zeka Asistanı', en: 'Restaurant AI Assistant', avatar: '🍽️' },
  'e-ticaret': { tr: 'E-Ticaret Yapay Zeka Asistanı', en: 'E-Commerce AI Assistant', avatar: '🛒' },
  'emlakci': { tr: 'Emlak & Gayrimenkul Yapay Zeka Asistanı', en: 'Real Estate & Properties AI Assistant', avatar: '🏠' },
  'otobus': { tr: 'Otobüs Firması Yapay Zeka Asistanı', en: 'Bus Travel AI Assistant', avatar: '🚌' },
  'otel': { tr: 'Otel Rezervasyon Yapay Zeka Asistanı', en: 'Hotel Booking AI Assistant', avatar: '🏨' },
  'influencer': { tr: 'Influencer Yapay Zeka Asistanı', en: 'Influencer AI Assistant', avatar: '📸' },
  'ozel': { tr: 'Özel Geliştirilmiş Asistan', en: 'Custom Advanced Assistant', avatar: '🔮' },
};

const SECTORS = Object.keys(SECTOR_METADATA);

export default function SectorSimulator() {
  const { lang, t } = useLang();
  const [activeSector, setActiveSector] = useState('kuafor');
  const [messages, setMessages] = useState([]);
  const [logs, setLogs] = useState([]);
  const [typingInput, setTypingInput] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [currentActionCard, setCurrentActionCard] = useState(null); // 'booking', 'payment', etc.
  const [cardFields, setCardFields] = useState({}); // Form input states
  const [cardStatus, setCardStatus] = useState('idle'); // 'idle', 'submitting', 'success'
  const [guestsVal, setGuestsVal] = useState('2');
  const [masaVal, setMasaVal] = useState('Bahçe');
  const [listingVal, setListingVal] = useState('2+1 Eşyalı Daire (Kadıköy)');
  const [systemVal, setSystemVal] = useState('Yangın Algılama');
  const [hotelRoomVal, setHotelRoomVal] = useState('Standart Oda');
  const [selectedSeat, setSelectedSeat] = useState(6);
  const [selectedDoc, setSelectedDoc] = useState('Dr. Canan Yılmaz');
  const [selectedDay, setSelectedDay] = useState(12);
  const [selectedSlot, setSelectedSlot] = useState('14:00');

  const chatBodyRef = useRef(null);
  const consoleBodyRef = useRef(null);
  const tabsContainerRef = useRef(null);
  const sessionRef = useRef(0);

  // Scroll to bottom helper
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages, isBotTyping, currentActionCard]);

  useEffect(() => {
    if (consoleBodyRef.current) {
      consoleBodyRef.current.scrollTop = consoleBodyRef.current.scrollHeight;
    }
  }, [logs]);

  // Console logging helper
  const addLog = (type, msgTr, msgEn) => {
    const timeStr = new Date().toTimeString().split(' ')[0];
    const text = lang === 'tr' ? msgTr : msgEn;
    setLogs((prev) => [...prev, { time: timeStr, type, text }]);
  };

  // Reset chat & logs
  const resetSimulator = (sector) => {
    sessionRef.current += 1;
    setMessages([]);
    setLogs([]);
    setTypingInput('');
    setIsBotTyping(false);
    setCurrentActionCard(null);
    setCardFields({});
    setCardStatus('idle');

    const displayName = SECTOR_METADATA[sector][lang] || SECTOR_METADATA[sector].tr;
    addLog('SYSTEM', `Sektör değiştirildi: ${displayName}`, `Sector switched to: ${displayName}`);

    // Welcome message
    const chats = T[lang]?.sector_chats?.[sector] || [];
    if (chats.length > 0 && chats[0].role === 'bot') {
      setIsBotTyping(true);
      const welcomeText = chats[0].text;
      setTimeout(() => {
        setIsBotTyping(false);
        setMessages([{ role: 'bot', text: welcomeText }]);
      }, 1000);
    }
  };

  // Initialize and handle sector changes
  useEffect(() => {
    resetSimulator(activeSector);
  }, [activeSector, lang]);

  // Auto-running simulation loop
  useEffect(() => {
    const currentSession = sessionRef.current;
    const chats = T[lang]?.sector_chats?.[activeSector] || [];
    if (chats.length === 0) return;

    // We start step after welcome message (which is index 0)
    let stepIndex = 1;

    const runNextStep = () => {
      if (currentSession !== sessionRef.current) return;
      if (stepIndex >= chats.length) {
        // Loop back to start after a delay
        setTimeout(() => {
          if (currentSession === sessionRef.current) {
            resetSimulator(activeSector);
          }
        }, 12000);
        return;
      }

      const nextMsg = chats[stepIndex];

      if (nextMsg.role === 'user') {
        // Animate user message typing
        let charIndex = 0;
        const textToType = nextMsg.text;

        const typeInterval = setInterval(() => {
          if (currentSession !== sessionRef.current) {
            clearInterval(typeInterval);
            return;
          }
          if (charIndex < textToType.length) {
            const char = textToType[charIndex];
            setTypingInput((prev) => prev + char);
            charIndex++;
          } else {
            clearInterval(typeInterval);
            // Submit user message
            setTimeout(() => {
              if (currentSession !== sessionRef.current) return;
              setMessages((prev) => [...prev, { role: 'user', text: textToType }]);
              setTypingInput('');
              stepIndex++;
              // Delay before bot reply
              setTimeout(runNextStep, 1000);
            }, 500);
          }
        }, 30);
      } else if (nextMsg.role === 'bot') {
        setIsBotTyping(true);
        addLog('API', `API Çağrısı başlatıldı: POST /v1/chat/completions`, `API Call initiated: POST /v1/chat/completions`);

        setTimeout(() => {
          if (currentSession !== sessionRef.current) return;
          setIsBotTyping(false);
          setMessages((prev) => [...prev, { role: 'bot', text: nextMsg.text }]);

          if (nextMsg.action) {
            addLog('AGENT', `Form arayüzü yüklendi: "${nextMsg.action}"`, `Form UI mounted: "${nextMsg.action}"`);
            setCurrentActionCard(nextMsg.action);
            setCardStatus('idle');

            // Simulate form typing after a short delay
            setTimeout(() => {
              if (currentSession !== sessionRef.current) return;
              animateFormFilling(nextMsg.action, () => {
                // Submit Form
                submitActionForm(nextMsg.action);
              });
            }, 1000);
          } else {
            stepIndex++;
            setTimeout(runNextStep, 2500);
          }
        }, 2000);
      }
    };

    // First delay after welcome message
    const welcomeTimer = setTimeout(runNextStep, 3500);

    return () => {
      clearTimeout(welcomeTimer);
    };
  }, [activeSector, lang]);

  // Form filling animation
  const animateFormFilling = (actionType, onComplete) => {
    const currentSession = sessionRef.current;
    const nameStr = lang === 'tr' ? 'Ahmet Yılmaz' : 'John Doe';
    const phoneStr = '0532 123 45 67';
    const emailStr = lang === 'tr' ? 'ahmet@gmail.com' : 'john.doe@gmail.com';

    // Helper functions for masking
    const maskNameVal = (v) => v.split(' ').map(w => w ? w[0] + '*'.repeat(w.length - 1) : '').join(' ');
    const maskPhoneVal = (v) => v.split('').map((c, i) => i < 2 || c === ' ' ? c : '*').join('');
    const maskEmailVal = (v) => {
      const idx = v.indexOf('@');
      if (idx === -1) return v[0] + '*'.repeat(v.length - 1);
      return v[0] + '*'.repeat(idx - 1) + v.substring(idx);
    };

    // Sequence of fields to fill
    const fieldsToFill = [];
    
    if (['booking', 'doctor_select', 'reservation', 'payment', 'service_booking', 'listing_booking', 'bus_booking', 'hotel_booking', 'sponsor_proposal'].includes(actionType)) {
      fieldsToFill.push({ key: 'name', value: nameStr, mask: maskNameVal });
      fieldsToFill.push({ key: 'phone', value: phoneStr, mask: maskPhoneVal });
      fieldsToFill.push({ key: 'email', value: emailStr, mask: maskEmailVal });
    }

    if (actionType === 'bus_booking') {
      fieldsToFill.push({ key: 'tc', value: '10293847562', mask: (v) => v.substring(0, 2) + '*'.repeat(v.length - 2) });
    }

    if (['payment', 'hotel_booking', 'bus_booking', 'sponsor_proposal'].includes(actionType)) {
      fieldsToFill.push({ key: 'ccHolder', value: nameStr.toUpperCase(), mask: maskNameVal });
      fieldsToFill.push({ key: 'ccNum', value: '5412 7500 1234 5678', mask: (v) => v.substring(0, 4) + v.substring(4).replace(/\d/g, '*') });
      fieldsToFill.push({ key: 'ccExpiry', value: '12/29', mask: (v) => v.split('/').map((p, i) => i === 0 ? p : '*'.repeat(p.length)).join('/') });
      fieldsToFill.push({ key: 'ccCvv', value: '123', mask: (v) => '*'.repeat(v.length) });
    }

    let fieldIdx = 0;

    const fillNextField = () => {
      if (currentSession !== sessionRef.current) return;
      if (fieldIdx >= fieldsToFill.length) {
        onComplete();
        return;
      }

      const field = fieldsToFill[fieldIdx];
      let charIdx = 0;
      setCardFields((prev) => ({ ...prev, [field.key]: '' }));

      const interval = setInterval(() => {
        if (currentSession !== sessionRef.current) {
          clearInterval(interval);
          return;
        }
        if (charIdx < field.value.length) {
          const partialReal = field.value.substring(0, charIdx + 1);
          const masked = field.mask(partialReal);
          setCardFields((prev) => ({ ...prev, [field.key]: masked }));
          charIdx++;
        } else {
          clearInterval(interval);
          fieldIdx++;
          setTimeout(fillNextField, 300);
        }
      }, 30);
    };

    fillNextField();
  };

  // Submit action form helper
  const submitActionForm = (actionType) => {
    const currentSession = sessionRef.current;
    setCardStatus('submitting');
    addLog('API', `API Çağrısı başlatıldı: POST /v1/actions/${actionType}`, `API Call initiated: POST /v1/actions/${actionType}`);

    setTimeout(() => {
      if (currentSession !== sessionRef.current) return;
      setCardStatus('success');
      addLog('DB', `Geçici kayıt oluşturuldu. Kayıt ID: REC_${Math.floor(Math.random() * 89999 + 10000)}`, `Temporary record created. Record ID: REC_${Math.floor(Math.random() * 89999 + 10000)}`);

      setTimeout(() => {
        if (currentSession !== sessionRef.current) return;
        // Add user confirmation message
        setCurrentActionCard(null);

        const maskedName = lang === 'tr' ? 'A**** Y****' : 'J**** D****';
        const maskedPhone = '05** *** ** 67';
        const maskedEmail = lang === 'tr' ? 'a****@gmail.com' : 'j****@gmail.com';
        const maskedDetails = `${maskedName}, ${maskedPhone}, ${maskedEmail}`;

        let selectionMsg = '';

        if (actionType === 'booking') {
          selectionMsg = lang === 'tr' 
            ? `12 Haziran Cuma 14:00 randevu bilgilerini doldurdum ve onayladım. (${maskedDetails})` 
            : `Confirmed appointment details for Friday, June 12 at 14:00. (${maskedDetails})`;
        } else if (actionType === 'doctor_select') {
          selectionMsg = lang === 'tr' 
            ? `Hekim randevu bilgilerini doldurdum ve onayladım: ${selectedDoc}. (${maskedDetails})` 
            : `Confirmed examination appointment with ${selectedDoc}. (${maskedDetails})`;
        } else if (actionType === 'reservation') {
          selectionMsg = lang === 'tr' 
            ? `${guestsVal} kişilik ${masaVal} masası rezervasyon bilgilerini doldurdum ve onayladım. (${maskedDetails})` 
            : `Confirmed table reservation for ${guestsVal} in ${masaVal} section. (${maskedDetails})`;
        } else if (actionType === 'payment') {
          selectionMsg = lang === 'tr' 
            ? `Kredi kartı ödeme bilgilerini doldurdum ve ödemeyi onayladım. (A**** Y****, 5412 **** **** 5678, ${maskedPhone}, ${maskedEmail})` 
            : `Filled card details and confirmed payment. (${maskedName}, 5412 **** **** 5678, ${maskedPhone}, ${maskedEmail})`;
        } else if (actionType === 'service_booking') {
          selectionMsg = lang === 'tr'
            ? `Zayıf akım periyodik servis talebini onayladım. Kategori: ${systemVal}. (${maskedDetails})`
            : `Confirmed weak current periodic service request. Category: ${systemVal}. (${maskedDetails})`;
        } else if (actionType === 'listing_booking') {
          selectionMsg = lang === 'tr'
            ? `Gayrimenkul gösterim randevusunu onayladım. Daire: ${listingVal}. (${maskedDetails})`
            : `Confirmed real estate viewing appointment. Apartment: ${listingVal}. (${maskedDetails})`;
        } else if (actionType === 'bus_booking') {
          selectionMsg = lang === 'tr'
            ? `Koltuk 6 için otobüs bilet ödeme bilgilerini doldurdum ve onayladım. (${maskedDetails})`
            : `Confirmed bus ticket payment details for Seat 6. (${maskedDetails})`;
        } else if (actionType === 'hotel_booking') {
          selectionMsg = lang === 'tr'
            ? `${hotelRoomVal} rezervasyonu için ödeme bilgilerini doldurdum ve onayladım. (${maskedDetails})`
            : `Confirmed hotel booking payment details for ${hotelRoomVal}. (${maskedDetails})`;
        } else if (actionType === 'sponsor_proposal') {
          selectionMsg = lang === 'tr'
            ? `Sponsorluk teklifini ve kredi kartı ödeme bilgilerini doldurup onayladım. (Moda Tekstil, ₺16.000, A**** Y****, 5412 **** **** 5678)`
            : `Filled sponsorship details and confirmed payment. (Fashion Textile, $480, J**** D****, 5412 **** **** 5678)`;
        }

        setMessages((prev) => [...prev, { role: 'user', text: selectionMsg }]);
        addLog('SYSTEM', 'Kişisel veriler maskelendi: "Ahmet Yılmaz" -> "A**** Y****"', 'Personal data masked: "Ahmet Yılmaz" -> "A**** Y****"');

        setTimeout(() => {
          if (currentSession !== sessionRef.current) return;
          addLog('DB', `İşlem veritabanına yazıldı. Müşteri: A**** Y****`, `Transaction written to DB. Customer: A**** Y****`);
        }, 300);

        setTimeout(() => {
          if (currentSession !== sessionRef.current) return;
          addLog('SMS', 'Onay bildirim SMS sırasına alındı. Alıcı: +905***', 'Confirmation SMS notification queued. Recipient: +905***');
        }, 700);

        // Add Bot final confirmation
        setTimeout(() => {
          if (currentSession !== sessionRef.current) return;
          let botConfirmation = '';
          if (actionType === 'booking') {
            botConfirmation = lang === 'tr' 
              ? 'Randevunuz oluşturuldu! 📅 12 Haziran Cuma saat 14:00\'da sizi bekliyoruz. Rezervasyon Kodunuz: **BLA-928**'
              : 'Your appointment is confirmed! 📅 We look forward to seeing you on Friday, June 12 at 14:00. Booking ID: **BLA-928**';
          } else if (actionType === 'doctor_select') {
            botConfirmation = lang === 'tr'
              ? `Muayene randevunuz ${selectedDoc} için oluşturulmuştur. Sizi en kısa sürede arayacağız. 🦷`
              : `Your examination appointment with ${selectedDoc} has been created. We will contact you shortly. 🦷`;
          } else if (actionType === 'reservation') {
            botConfirmation = lang === 'tr'
              ? `Masanız rezerve edildi! 🍽️ ${masaVal} bölümünde ${guestsVal} kişilik yeriniz hazır. Rezervasyon bilgileriniz SMS ile gönderildi.`
              : `Your table is reserved! 🍽️ Your table for ${guestsVal} in the ${masaVal} area is ready. Reservation details sent via SMS.`;
          } else if (actionType === 'payment') {
            botConfirmation = lang === 'tr'
              ? 'Ödemeniz alındı! 💳 Siparişiniz başarıyla oluşturuldu. Sipariş Kodu: **#TRM-7382**. Kargo takibinizi buradan yapabilirsiniz.'
              : 'Payment received! 💳 Your order has been placed successfully. Order Code: **#TRM-7382**. You can track your shipment here.';
          } else if (actionType === 'service_booking') {
            botConfirmation = lang === 'tr'
              ? `Servis talebiniz alındı! ⚡ Saha teknik ekibimiz ${systemVal} sisteminin kontrolü için sizinle iletişime geçecektir. Takip No: **SRV-9082**`
              : `Service request received! ⚡ Our field technical team will contact you to inspect the ${systemVal} system. Ticket ID: **SRV-9082**`;
          } else if (actionType === 'listing_booking') {
            botConfirmation = lang === 'tr'
              ? `Gösterim randevunuz oluşturuldu! 🏠 Danışmanımız ${listingVal} gösterimi için sizinle iletişime geçecektir. Randevu onayınız SMS olarak gönderilmiştir.`
              : `Viewing appointment confirmed! 🏠 Our consultant will contact you for the ${listingVal} viewing. Confirmation sent via SMS.`;
          } else if (actionType === 'bus_booking') {
            botConfirmation = lang === 'tr'
              ? 'Biletiniz kesildi! 🚌 12 Haziran Cuma saat 14:00\'da peronda olmanızı rica ederiz. Koltuk No: **6**. PNR Kodunuz: **PNR-89283**'
              : 'Your ticket is issued! 🚌 Please be at the platform on Friday, June 12 at 14:00. Seat No: **6**. PNR Code: **PNR-89283**';
          } else if (actionType === 'hotel_booking') {
            botConfirmation = lang === 'tr'
              ? `Rezervasyonunuz onaylandı! 🏨 12 Haziran girişli 3 gecelik ${hotelRoomVal} konaklamanız hazır. Rezervasyon Kodunuz: **HTL-9828**`
              : `Your booking is confirmed! 🏨 Your 3-night stay in a ${hotelRoomVal} starting June 12 is ready. Booking ID: **HTL-9828**`;
          } else if (actionType === 'sponsor_proposal') {
            botConfirmation = lang === 'tr'
              ? 'Sponsorluk ödemeniz başarıyla alındı! 💳 Anlaşma onaylandı. Sponsorluk ID: **SPO-8923**. Merve Yıldırım en kısa sürede reklam içeriğini hazırlayacaktır.'
              : 'Sponsorship payment received! 💳 Deal is confirmed. Sponsorship ID: **SPO-8923**. Merve Yildirim will prepare the promotional content shortly.';
          }

          setMessages((prev) => [...prev, { role: 'bot', text: botConfirmation }]);
          
          // Re-trigger simulator reset after a delay
          setTimeout(() => {
            if (currentSession === sessionRef.current) {
              resetSimulator(activeSector);
            }
          }, 8000);
        }, 1500);

      }, 1500);
    }, 2000);
  };

  const handleTabScroll = (direction) => {
    if (tabsContainerRef.current) {
      const amount = direction === 'left' ? -180 : 180;
      tabsContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  const renderCardContent = () => {
    if (!currentActionCard) return null;

    if (cardStatus === 'submitting') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}>
          <span className="sim-spinner"></span>
          <span style={{ marginTop: '8px', fontSize: '12px' }}>{lang === 'tr' ? 'İşleniyor...' : 'Processing...'}</span>
        </div>
      );
    }

    if (cardStatus === 'success') {
      return (
        <div className="sim-success-animation">
          <div className="sim-success-checkmark">✓</div>
          <div className="sim-success-text">{lang === 'tr' ? 'Başarılı!' : 'Success!'}</div>
        </div>
      );
    }

    switch (currentActionCard) {
      case 'booking':
        return (
          <>
            <div className="sim-booking-title">{lang === 'tr' ? 'Randevu Seçimi' : 'Appointment Booking'}</div>
            <div className="sim-booking-days">
              <div className={`sim-booking-day ${selectedDay === 12 ? 'selected' : ''}`} onClick={() => setSelectedDay(12)}>
                <span className="day-name">{lang === 'tr' ? 'Cum' : 'Fri'}</span>
                <span className="day-num">12</span>
              </div>
              <div className={`sim-booking-day ${selectedDay === 13 ? 'selected' : ''}`} onClick={() => setSelectedDay(13)}>
                <span className="day-name">{lang === 'tr' ? 'Cmt' : 'Sat'}</span>
                <span className="day-num">13</span>
              </div>
              <div className={`sim-booking-day ${selectedDay === 15 ? 'selected' : ''}`} onClick={() => setSelectedDay(15)}>
                <span className="day-name">{lang === 'tr' ? 'Pzt' : 'Mon'}</span>
                <span className="day-num">15</span>
              </div>
            </div>
            <div className="sim-booking-slots">
              <div className={`sim-booking-slot ${selectedSlot === '10:00' ? 'selected' : ''}`} onClick={() => setSelectedSlot('10:00')}>10:00</div>
              <div className={`sim-booking-slot ${selectedSlot === '14:00' ? 'selected' : ''}`} onClick={() => setSelectedSlot('14:00')}>14:00</div>
              <div className={`sim-booking-slot ${selectedSlot === '16:00' ? 'selected' : ''}`} onClick={() => setSelectedSlot('16:00')}>16:00</div>
            </div>
            <div className="sim-form-row" style={{ marginTop: '10px' }}>
              <div className="sim-field" style={{ width: '100%' }}>
                <label>{lang === 'tr' ? 'Adınız Soyadınız' : 'Your Name'}</label>
                <input type="text" className="sim-card-input-name" value={cardFields.name || ''} readOnly />
              </div>
            </div>
            <div className="sim-form-row">
              <div className="sim-field">
                <label>{lang === 'tr' ? 'Telefon Numaranız' : 'Phone Number'}</label>
                <input type="text" className="sim-card-input-phone" value={cardFields.phone || ''} readOnly />
              </div>
              <div className="sim-field">
                <label>{lang === 'tr' ? 'E-posta Adresiniz' : 'Email Address'}</label>
                <input type="text" className="sim-card-input-email" value={cardFields.email || ''} readOnly />
              </div>
            </div>
            <button className="sim-btn-confirm" onClick={() => submitActionForm('booking')}>
              <span>{lang === 'tr' ? 'Randevuyu Onayla 📅' : 'Confirm Appointment 📅'}</span>
            </button>
          </>
        );
      case 'doctor_select':
        return (
          <>
            <div className="sim-booking-title">{lang === 'tr' ? 'Hekim Seçimi' : 'Dentist Selection'}</div>
            <div className="sim-doc-list">
              <div className={`sim-doc-item ${selectedDoc === 'Dr. Canan Yılmaz' ? 'selected' : ''}`} onClick={() => setSelectedDoc('Dr. Canan Yılmaz')}>
                <div className="sim-doc-avatar">👩‍⚕️</div>
                <div className="sim-doc-info">
                  <span className="sim-doc-name">Dr. Canan Yılmaz</span>
                  <span className="sim-doc-title">{lang === 'tr' ? 'Ortodonti Uzmanı' : 'Orthodontist'}</span>
                </div>
              </div>
              <div className={`sim-doc-item ${selectedDoc === 'Dr. Ahmet Kaya' ? 'selected' : ''}`} onClick={() => setSelectedDoc('Dr. Ahmet Kaya')}>
                <div className="sim-doc-avatar">👨‍⚕️</div>
                <div className="sim-doc-info">
                  <span className="sim-doc-name">Dr. Ahmet Kaya</span>
                  <span className="sim-doc-title">{lang === 'tr' ? 'Çene Cerrahı' : 'Oral Surgeon'}</span>
                </div>
              </div>
            </div>
            <div className="sim-form-row" style={{ marginTop: '10px' }}>
              <div className="sim-field" style={{ width: '100%' }}>
                <label>{lang === 'tr' ? 'Adınız Soyadınız' : 'Your Name'}</label>
                <input type="text" className="sim-card-input-name" value={cardFields.name || ''} readOnly />
              </div>
            </div>
            <div className="sim-form-row">
              <div className="sim-field">
                <label>{lang === 'tr' ? 'Telefon Numaranız' : 'Phone Number'}</label>
                <input type="text" className="sim-card-input-phone" value={cardFields.phone || ''} readOnly />
              </div>
              <div className="sim-field">
                <label>{lang === 'tr' ? 'E-posta Adresiniz' : 'Email Address'}</label>
                <input type="text" className="sim-card-input-email" value={cardFields.email || ''} readOnly />
              </div>
            </div>
            <button className="sim-btn-confirm" onClick={() => submitActionForm('doctor_select')}>
              <span>{lang === 'tr' ? 'Hekimi Seç ve İlerle' : 'Select Doctor & Continue'}</span>
            </button>
          </>
        );
      case 'reservation':
        return (
          <>
            <div className="sim-booking-title">{lang === 'tr' ? 'Rezervasyon Bilgileri' : 'Reservation Details'}</div>
            <div className="sim-form-row">
              <div className="sim-field">
                <label>{lang === 'tr' ? 'Kişi Sayısı' : 'Guests'}</label>
                <select id="simGuests" value={guestsVal} onChange={(e) => setGuestsVal(e.target.value)} style={{ width: '100%', background: 'var(--background-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '6px', borderRadius: '4px', fontSize: '12px' }}>
                  <option value="2">2 {lang === 'tr' ? 'Kişi' : 'People'}</option>
                  <option value="4">4 {lang === 'tr' ? 'Kişi' : 'People'}</option>
                  <option value="6">6 {lang === 'tr' ? 'Kişi' : 'People'}</option>
                </select>
              </div>
              <div className="sim-field">
                <label>{lang === 'tr' ? 'Tercih' : 'Preference'}</label>
                <select id="simMasa" value={masaVal} onChange={(e) => setMasaVal(e.target.value)} style={{ width: '100%', background: 'var(--background-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '6px', borderRadius: '4px', fontSize: '12px' }}>
                  <option value="Bahçe">{lang === 'tr' ? 'Bahçe' : 'Garden'}</option>
                  <option value="Cam Kenarı">{lang === 'tr' ? 'Cam Kenarı' : 'Window'}</option>
                </select>
              </div>
            </div>
            <div className="sim-form-row" style={{ marginTop: '10px' }}>
              <div className="sim-field" style={{ width: '100%' }}>
                <label>{lang === 'tr' ? 'Adınız Soyadınız' : 'Your Name'}</label>
                <input type="text" className="sim-card-input-name" value={cardFields.name || ''} readOnly />
              </div>
            </div>
            <div className="sim-form-row">
              <div className="sim-field">
                <label>{lang === 'tr' ? 'Telefon Numaranız' : 'Phone Number'}</label>
                <input type="text" className="sim-card-input-phone" value={cardFields.phone || ''} readOnly />
              </div>
              <div className="sim-field">
                <label>{lang === 'tr' ? 'E-posta Adresiniz' : 'Email Address'}</label>
                <input type="text" className="sim-card-input-email" value={cardFields.email || ''} readOnly />
              </div>
            </div>
            <button className="sim-btn-confirm" onClick={() => submitActionForm('reservation')}>
              <span>{lang === 'tr' ? 'Rezervasyonu Tamamla 🍽' : 'Complete Reservation 🍽'}</span>
            </button>
          </>
        );
      case 'payment':
        return (
          <>
            <div className="sim-booking-title">{lang === 'tr' ? 'Güvenli Kredi Kartı Ödemesi' : 'Secure Credit Card Payment'}</div>
            <div className="sim-cc-card">
              <div className="sim-cc-visual">
                <div className="sim-cc-chip"></div>
                <div className="sim-cc-number" id="ccCardNum">{cardFields.ccNum || '•••• •••• •••• ••••'}</div>
                <div className="sim-cc-bottom">
                  <div className="sim-cc-holder" id="ccCardHolder">{cardFields.ccHolder || 'KART SAHİBİ'}</div>
                  <div className="sim-cc-expiry" id="ccCardExpiry">{cardFields.ccExpiry || 'AA/YY'}</div>
                </div>
              </div>
            </div>
            <div className="sim-cc-fields">
              <div className="sim-field">
                <input type="text" placeholder={lang === 'tr' ? 'Kart Sahibi' : 'Cardholder Name'} value={cardFields.ccHolder || ''} style={{ padding: '6px 10px', fontSize: '11px' }} readOnly />
              </div>
              <div className="sim-form-row">
                <input type="text" placeholder="5412 7500 1234 5678" value={cardFields.ccNum || ''} style={{ padding: '6px 10px', fontSize: '11px', gridColumn: 'span 1' }} readOnly />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                  <input type="text" placeholder="12/29" value={cardFields.ccExpiry || ''} style={{ padding: '6px 10px', fontSize: '11px' }} readOnly />
                  <input type="password" placeholder="CVV" value={cardFields.ccCvv || ''} style={{ padding: '6px 10px', fontSize: '11px' }} readOnly />
                </div>
              </div>
            </div>
            <div className="sim-form-row" style={{ marginTop: '10px' }}>
              <div className="sim-field">
                <label>{lang === 'tr' ? 'Telefon Numaranız' : 'Phone Number'}</label>
                <input type="text" className="sim-card-input-phone" value={cardFields.phone || ''} readOnly />
              </div>
              <div className="sim-field">
                <label>{lang === 'tr' ? 'E-posta Adresiniz' : 'Email Address'}</label>
                <input type="text" className="sim-card-input-email" value={cardFields.email || ''} readOnly />
              </div>
            </div>
            <button className="sim-btn-confirm" onClick={() => submitActionForm('payment')}>
              <span>{lang === 'tr' ? 'Güvenli Ödeme Yap (₺499) 💳' : 'Pay Securely ($49) 💳'}</span>
            </button>
          </>
        );
      case 'service_booking':
        return (
          <>
            <div className="sim-booking-title">{lang === 'tr' ? 'Servis Talebi & Sistem Seçimi' : 'Service Request & System'}</div>
            <div className="sim-form-row">
              <div className="sim-field" style={{ width: '100%' }}>
                <label>{lang === 'tr' ? 'Sistem Kapsamı' : 'System Scope'}</label>
                <select id="simSystem" value={systemVal} onChange={(e) => setSystemVal(e.target.value)} style={{ width: '100%', background: 'var(--background-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '6px', borderRadius: '4px', fontSize: '12px' }}>
                  <option value="Yangın Algılama">{lang === 'tr' ? 'Yangın Algılama Sistemleri' : 'Fire Detection Systems'}</option>
                  <option value="Akıllı Bina / Otomasyon">{lang === 'tr' ? 'Akıllı Bina ve Otomasyon' : 'Smart Building & Automation'}</option>
                  <option value="Aydınlatma Kontrolü">{lang === 'tr' ? 'Aydınlatma Kontrol Sistemleri' : 'Lighting Control Systems'}</option>
                  <option value="Zayıf Akım / Kartlı Geçiş">{lang === 'tr' ? 'Zayıf Akım / Geçiş Kontrol' : 'Weak Current / Access Control'}</option>
                </select>
              </div>
            </div>
            <div className="sim-form-row" style={{ marginTop: '10px' }}>
              <div className="sim-field" style={{ width: '100%' }}>
                <label>{lang === 'tr' ? 'Adınız Soyadınız' : 'Your Name'}</label>
                <input type="text" className="sim-card-input-name" value={cardFields.name || ''} readOnly />
              </div>
            </div>
            <div className="sim-form-row">
              <div className="sim-field">
                <label>{lang === 'tr' ? 'Telefon Numaranız' : 'Phone Number'}</label>
                <input type="text" className="sim-card-input-phone" value={cardFields.phone || ''} readOnly />
              </div>
              <div className="sim-field">
                <label>{lang === 'tr' ? 'E-posta Adresiniz' : 'Email Address'}</label>
                <input type="text" className="sim-card-input-email" value={cardFields.email || ''} readOnly />
              </div>
            </div>
            <button className="sim-btn-confirm" onClick={() => submitActionForm('service_booking')}>
              <span>{lang === 'tr' ? 'Servis Talebini Onayla ⚡' : 'Confirm Service Request ⚡'}</span>
            </button>
          </>
        );
      case 'listing_booking':
        return (
          <>
            <div className="sim-booking-title">{lang === 'tr' ? 'Gösterim Randevusu' : 'Property Viewing Appointment'}</div>
            <div className="sim-form-row">
              <div className="sim-field" style={{ width: '100%' }}>
                <label>{lang === 'tr' ? 'İlgilenilen Daire / Portföy' : 'Interested Apartment / Portfolio'}</label>
                <select id="simListing" value={listingVal} onChange={(e) => setListingVal(e.target.value)} style={{ width: '100%', background: 'var(--background-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '6px', borderRadius: '4px', fontSize: '12px' }}>
                  <option value="2+1 Eşyalı Daire (Kadıköy)">2+1 Eşyalı Daire - Kadıköy (₺35.000/Ay)</option>
                  <option value="1+1 Lüx Rezidans (Kadıköy)">1+1 Lüx Rezidans - Kadıköy (₺28.000/Ay)</option>
                </select>
              </div>
            </div>
            <div className="sim-form-row" style={{ marginTop: '10px' }}>
              <div className="sim-field" style={{ width: '100%' }}>
                <label>{lang === 'tr' ? 'Adınız Soyadınız' : 'Your Name'}</label>
                <input type="text" className="sim-card-input-name" value={cardFields.name || ''} readOnly />
              </div>
            </div>
            <div className="sim-form-row">
              <div className="sim-field">
                <label>{lang === 'tr' ? 'Telefon Numaranız' : 'Phone Number'}</label>
                <input type="text" className="sim-card-input-phone" value={cardFields.phone || ''} readOnly />
              </div>
              <div className="sim-field">
                <label>{lang === 'tr' ? 'E-posta Adresiniz' : 'Email Address'}</label>
                <input type="text" className="sim-card-input-email" value={cardFields.email || ''} readOnly />
              </div>
            </div>
            <button className="sim-btn-confirm" onClick={() => submitActionForm('listing_booking')}>
              <span>{lang === 'tr' ? 'Gösterim Randevusunu Onayla 🏠' : 'Confirm Viewing Appointment 🏠'}</span>
            </button>
          </>
        );
      case 'bus_booking':
        return (
          <>
            <div className="sim-booking-title">{lang === 'tr' ? 'Otobüs Bileti ve Güvenli Ödeme' : 'Bus Ticket & Secure Payment'}</div>
            <div className="sim-bus-container">
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '6px' }}>
                {lang === 'tr' ? 'İstanbul ➔ Ankara (12 Haziran Cuma 14:00)' : 'Istanbul ➔ Ankara (Friday, June 12 14:00)'}
              </div>
              <div className="sim-bus-layout">
                <div className="sim-seat occupied">1</div>
                <div className="sim-seat occupied">2</div>
                <div className="sim-bus-aisle"></div>
                <div className="sim-seat" onClick={() => setSelectedSeat(3)}>3</div>
                
                <div className="sim-seat" onClick={() => setSelectedSeat(4)}>4</div>
                <div className="sim-seat occupied">5</div>
                <div className="sim-bus-aisle"></div>
                <div className={`sim-seat ${selectedSeat === 6 ? 'selected' : ''}`} onClick={() => setSelectedSeat(6)}>6</div>
                
                <div className="sim-seat" onClick={() => setSelectedSeat(7)}>7</div>
                <div className="sim-seat" onClick={() => setSelectedSeat(8)}>8</div>
                <div className="sim-bus-aisle"></div>
                <div className="sim-seat" onClick={() => setSelectedSeat(9)}>9</div>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                {lang === 'tr' ? `Seçilen Koltuk: ${selectedSeat} (2+1 Rahat)` : `Selected Seat: ${selectedSeat} (2+1 Comfort)`}
              </div>
            </div>
            <div className="sim-form-row">
              <div className="sim-field" style={{ width: '100%' }}>
                <label>{lang === 'tr' ? 'T.C. Kimlik Numarası' : 'ID / Passport Number'}</label>
                <input type="text" className="sim-card-input-tc" value={cardFields.tc || ''} readOnly />
              </div>
            </div>
            <div className="sim-form-row" style={{ marginTop: '6px' }}>
              <div className="sim-field" style={{ width: '100%' }}>
                <label>{lang === 'tr' ? 'Yolcu Adı Soyadı' : 'Passenger Name'}</label>
                <input type="text" className="sim-card-input-name" value={cardFields.name || ''} readOnly />
              </div>
            </div>
            <div className="sim-form-row">
              <div className="sim-field">
                <label>{lang === 'tr' ? 'Telefon Numaranız' : 'Phone Number'}</label>
                <input type="text" className="sim-card-input-phone" value={cardFields.phone || ''} readOnly />
              </div>
              <div className="sim-field">
                <label>{lang === 'tr' ? 'E-posta Adresiniz' : 'Email Address'}</label>
                <input type="text" className="sim-card-input-email" value={cardFields.email || ''} readOnly />
              </div>
            </div>
            <div className="sim-cc-fields" style={{ marginTop: '8px' }}>
              <div className="sim-field">
                <input type="text" placeholder={lang === 'tr' ? 'Kart Sahibi' : 'Cardholder Name'} value={cardFields.ccHolder || ''} style={{ padding: '6px 10px', fontSize: '11px' }} readOnly />
              </div>
              <div className="sim-form-row" style={{ marginTop: '4px' }}>
                <input type="text" placeholder="5412 7500 1234 5678" value={cardFields.ccNum || ''} style={{ padding: '6px 10px', fontSize: '11px', gridColumn: 'span 1' }} readOnly />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                  <input type="text" placeholder="12/29" value={cardFields.ccExpiry || ''} style={{ padding: '6px 10px', fontSize: '11px' }} readOnly />
                  <input type="password" placeholder="CVV" value={cardFields.ccCvv || ''} style={{ padding: '6px 10px', fontSize: '11px' }} readOnly />
                </div>
              </div>
            </div>
            <button className="sim-btn-confirm" onClick={() => submitActionForm('bus_booking')} style={{ marginTop: '10px' }}>
              <span>{lang === 'tr' ? 'Bilet Satın Al (₺500) 🚌' : 'Buy Ticket ($20) 🚌'}</span>
            </button>
          </>
        );
      case 'hotel_booking':
        return (
          <>
            <div className="sim-booking-title">{lang === 'tr' ? 'Otel Rezervasyon ve Güvenli Ödeme' : 'Hotel Reservation & Payment'}</div>
            <div className="sim-form-row">
              <div className="sim-field" style={{ width: '100%' }}>
                <label>{lang === 'tr' ? 'Tarihler ve Oda Tipi' : 'Dates & Room Type'}</label>
                <select id="simHotelRoom" value={hotelRoomVal} onChange={(e) => setHotelRoomVal(e.target.value)} style={{ width: '100%', background: 'var(--background-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '6px', borderRadius: '4px', fontSize: '12px' }}>
                  <option value="Standart Oda">{lang === 'tr' ? 'Standart Oda (12-15 Haziran - 3 Gece - ₺13.500)' : 'Standard Room (June 12-15 - 3 Nights - $450)'}</option>
                  <option value="Deluxe Suite">{lang === 'tr' ? 'Deluxe Suite (12-15 Haziran - 3 Gece - ₺22.500)' : 'Deluxe Suite (June 12-15 - 3 Nights - $750)'}</option>
                </select>
              </div>
            </div>
            <div className="sim-form-row" style={{ marginTop: '6px' }}>
              <div className="sim-field" style={{ width: '100%' }}>
                <label>{lang === 'tr' ? 'Misafir Adı Soyadı' : 'Guest Name'}</label>
                <input type="text" className="sim-card-input-name" value={cardFields.name || ''} readOnly />
              </div>
            </div>
            <div className="sim-form-row">
              <div className="sim-field">
                <label>{lang === 'tr' ? 'Telefon Numaranız' : 'Phone Number'}</label>
                <input type="text" className="sim-card-input-phone" value={cardFields.phone || ''} readOnly />
              </div>
              <div className="sim-field">
                <label>{lang === 'tr' ? 'E-posta Adresiniz' : 'Email Address'}</label>
                <input type="text" className="sim-card-input-email" value={cardFields.email || ''} readOnly />
              </div>
            </div>
            <div className="sim-cc-fields" style={{ marginTop: '8px' }}>
              <div className="sim-field">
                <input type="text" placeholder={lang === 'tr' ? 'Kart Sahibi' : 'Cardholder Name'} value={cardFields.ccHolder || ''} style={{ padding: '6px 10px', fontSize: '11px' }} readOnly />
              </div>
              <div className="sim-form-row" style={{ marginTop: '4px' }}>
                <input type="text" placeholder="5412 7500 1234 5678" value={cardFields.ccNum || ''} style={{ padding: '6px 10px', fontSize: '11px', gridColumn: 'span 1' }} readOnly />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                  <input type="text" placeholder="12/29" value={cardFields.ccExpiry || ''} style={{ padding: '6px 10px', fontSize: '11px' }} readOnly />
                  <input type="password" placeholder="CVV" value={cardFields.ccCvv || ''} style={{ padding: '6px 10px', fontSize: '11px' }} readOnly />
                </div>
              </div>
            </div>
            <button className="sim-btn-confirm" onClick={() => submitActionForm('hotel_booking')} style={{ marginTop: '10px' }}>
              <span>{lang === 'tr' ? 'Rezervasyon Onayla ve Öde (₺13.500) 🏨' : 'Confirm & Pay Reservation ($450) 🏨'}</span>
            </button>
          </>
        );
      case 'sponsor_proposal':
        return (
          <>
            <div className="sim-booking-title">{lang === 'tr' ? 'Sponsorluk Anlaşması & Güvenli Ödeme' : 'Sponsorship Deal & Secure Payment'}</div>
            <div className="sim-form-row">
              <div className="sim-field">
                <label>{lang === 'tr' ? 'Sponsor Marka' : 'Sponsor Brand'}</label>
                <input type="text" className="sim-card-input-brand" value={lang === 'tr' ? 'Moda Tekstil' : 'Fashion Textile'} readOnly style={{ padding: '6px 10px', fontSize: '11px' }} />
              </div>
              <div className="sim-field">
                <label>{lang === 'tr' ? 'Tanıtılacak Ürün' : 'Product Name'}</label>
                <input type="text" className="sim-card-input-product" value={lang === 'tr' ? 'Kışlık Mont' : 'Winter Coat'} readOnly style={{ padding: '6px 10px', fontSize: '11px' }} />
              </div>
            </div>
            <div className="sim-form-row" style={{ marginTop: '6px' }}>
              <div className="sim-field">
                <label>{lang === 'tr' ? 'Kategori' : 'Category'}</label>
                <input type="text" className="sim-card-input-category" value={lang === 'tr' ? 'Moda' : 'Fashion'} readOnly style={{ padding: '6px 10px', fontSize: '11px' }} />
              </div>
              <div className="sim-field">
                <label>{lang === 'tr' ? 'Mecralar' : 'Platforms'}</label>
                <input type="text" className="sim-card-input-platform" value="Instagram Story, TikTok Video" readOnly style={{ padding: '6px 10px', fontSize: '11px' }} />
              </div>
            </div>
            <div className="sim-form-row" style={{ marginTop: '6px' }}>
              <div className="sim-field" style={{ width: '100%' }}>
                <label>{lang === 'tr' ? 'Hesaplanan Sponsorluk Ücreti' : 'Calculated Sponsorship Price'}</label>
                <input type="text" className="sim-card-input-price" value={lang === 'tr' ? '₺16.000 ($480)' : '$480 (₺16.000)'} readOnly style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 'bold', color: 'var(--green-500)', background: 'rgba(34,197,94,0.08)' }} />
              </div>
            </div>

            <div className="sim-cc-card" style={{ marginTop: '12px' }}>
              <div className="sim-cc-visual">
                <div className="sim-cc-chip"></div>
                <div className="sim-cc-number" id="ccCardNum">{cardFields.ccNum || '•••• •••• •••• ••••'}</div>
                <div className="sim-cc-bottom">
                  <div className="sim-cc-holder" id="ccCardHolder">{cardFields.ccHolder || 'KART SAHİBİ'}</div>
                  <div className="sim-cc-expiry" id="ccCardExpiry">{cardFields.ccExpiry || 'AA/YY'}</div>
                </div>
              </div>
            </div>

            <div className="sim-cc-fields" style={{ marginTop: '8px' }}>
              <div className="sim-field">
                <input type="text" placeholder={lang === 'tr' ? 'Kart Sahibi' : 'Cardholder Name'} value={cardFields.ccHolder || ''} style={{ padding: '6px 10px', fontSize: '11px' }} readOnly />
              </div>
              <div className="sim-form-row" style={{ marginTop: '4px' }}>
                <input type="text" placeholder="5412 7500 1234 5678" value={cardFields.ccNum || ''} style={{ padding: '6px 10px', fontSize: '11px', gridColumn: 'span 1' }} readOnly />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                  <input type="text" placeholder="12/29" value={cardFields.ccExpiry || ''} style={{ padding: '6px 10px', fontSize: '11px' }} readOnly />
                  <input type="password" placeholder="CVV" value={cardFields.ccCvv || ''} style={{ padding: '6px 10px', fontSize: '11px' }} readOnly />
                </div>
              </div>
            </div>

            <div className="sim-form-row" style={{ marginTop: '10px' }}>
              <div className="sim-field">
                <label>{lang === 'tr' ? 'Telefon Numaranız' : 'Phone Number'}</label>
                <input type="text" className="sim-card-input-phone" value={cardFields.phone || ''} readOnly />
              </div>
              <div className="sim-field">
                <label>{lang === 'tr' ? 'E-posta Adresiniz' : 'Email Address'}</label>
                <input type="text" className="sim-card-input-email" value={cardFields.email || ''} readOnly />
              </div>
            </div>
            <button className="sim-btn-confirm" onClick={() => submitActionForm('sponsor_proposal')} style={{ marginTop: '12px' }}>
              <span>{lang === 'tr' ? 'Sponsorluk Anlaşmasını Tamamla & Öde 💳' : 'Complete Sponsorship Deal & Pay 💳'}</span>
            </button>
          </>
        );
      case 'custom_note':
        return (
          <div className="sim-info-note-card">
            <div className="sim-info-note-icon">💡</div>
            <div className="sim-info-note-text">
              <strong>{lang === 'tr' ? 'Hayal Gücünüzle Sınırlı!' : 'Limitless Possibilities!'}</strong><br />
              {lang === 'tr' 
                ? 'Ragleaf ile bu ve benzeri her türlü özel yapay zeka asistanını dakikalar içinde geliştirebilir, dilediğiniz veri kaynaklarıyla eğitebilirsiniz. Tek sınır hayal gücünüz!' 
                : 'With Ragleaf, you can build any custom AI assistant like this in minutes, trained on your own data sources. The only limit is your imagination!'}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="sector-simulator-container">
      {/* Simulator Header */}
      <div className="sim-intro-header">
        <h2 className="sim-intro-title">
          <svg className="sim-title-icon" viewBox="0 0 24 24" fill="none" stroke="url(#sim-icon-grad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <linearGradient id="sim-icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22c55e"></stop>
                <stop offset="100%" stopColor="#06b6d4"></stop>
              </linearGradient>
            </defs>
            <polyline points="4 17 10 11 4 5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
          </svg>
          <span>{t('sim_title')}</span>
        </h2>
        <p className="sim-intro-desc">{t('sim_desc')}</p>
      </div>

      {/* Sector Selector Tabs */}
      <div className="sim-sector-tabs-header">
        <div className="sim-tabs-slider-wrapper">
          <button className="sim-tabs-arrow left" onClick={() => handleTabScroll('left')} aria-label="Sola kaydır">&lsaquo;</button>
          <div className="sim-tabs-scroll-container">
            <div className="hero-tabs" ref={tabsContainerRef} style={{ cursor: 'grab' }}>
              {SECTORS.map((sec) => (
                <button
                  key={sec}
                  className={`hero-tab-btn ${activeSector === sec ? 'active' : ''}`}
                  onClick={() => setActiveSector(sec)}
                >
                  <span>{t(`sec_${sec === 'emlakci' ? 'emlakci' : sec === 'dis-hekimi' ? 'dental' : sec === 'guzellik-salonu' ? 'guzellik_salonu' : sec === 'e-ticaret' ? 'ecommerce' : sec === 'otobus' ? 'otobus' : sec === 'otel' ? 'otel' : sec === 'kuafor' ? 'kuafor' : sec === 'restoran' ? 'restoran' : sec === 'influencer' ? 'influencer' : 'ozel'}`)}</span>
                </button>
              ))}
            </div>
          </div>
          <button className="sim-tabs-arrow right" onClick={() => handleTabScroll('right')} aria-label="Sağa kaydır">&rsaquo;</button>
        </div>
      </div>

      {/* Simulator Main Body */}
      <div className="sim-chat-widget" id="sectorDemoWidget">
        <div className="sim-chat-widget-inner">
          {/* Chat Pane */}
          <div className="sim-chat-main-pane">
            <div className="sim-chat-header">
              <div className="sim-chat-bot-profile">
                <div className="sim-chat-avatar" id="simAvatar">
                  {SECTOR_METADATA[activeSector].avatar} <span className="sim-chat-avatar-status"></span>
                </div>
                <div className="sim-chat-bot-info">
                  <span className="sim-chat-bot-name" id="simName">
                    {SECTOR_METADATA[activeSector][lang] || SECTOR_METADATA[activeSector].tr}
                  </span>
                </div>
              </div>
            </div>

            <div className="sim-chat-body" id="simChatBody" ref={chatBodyRef}>
              {messages.map((msg, index) => (
                <div key={index} className={`sim-chat-msg ${msg.role}`}>
                  {msg.text}
                </div>
              ))}
              
              {isBotTyping && (
                <div className="sim-chat-msg bot typing" id="simTypingIndicator">
                  <span className="pulse-dot"></span>
                  <span className="pulse-dot" style={{ animationDelay: '0.2s' }}></span>
                  <span className="pulse-dot" style={{ animationDelay: '0.4s' }}></span>
                </div>
              )}

              {currentActionCard && (
                <div className="sim-action-card">
                  {renderCardContent()}
                </div>
              )}
            </div>

            <div className="sim-chat-footer">
              <input
                type="text"
                className="sim-chat-input sim-sector-chat-input"
                placeholder={t('prompt_placeholder')}
                value={typingInput}
                readOnly
              />
              <button className="sim-chat-send-btn" style={{ cursor: 'default', pointerEvents: 'none' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="send-icon-svg">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </div>

          {/* Console Pane */}
          <div className="sim-chat-console-pane">
            <div className="sim-console-header">
              <span className="sim-console-dot red"></span>
              <span className="sim-console-dot yellow"></span>
              <span className="sim-console-dot green"></span>
              <span className="sim-console-title">Ragleaf Agent Log Console</span>
            </div>
            <div className="sim-console-body" id="simConsoleBody" ref={consoleBodyRef}>
              {logs.map((log, index) => (
                <div key={index} className="sim-console-log-line">
                  <span className="sim-console-log-time">[{log.time}]</span>{' '}
                  <span className={`sim-console-log-tag ${log.type.toLowerCase()}`}>[{log.type}]</span>{' '}
                  <span className="sim-console-log-text">{log.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
