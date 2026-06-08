import { useEffect, useState } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';

interface EmbedCodeResponse {
  agent_id: number;
  agent_name: string;
  public_id: string;
  has_api_key: boolean;
  api_key_prefix: string;
  embed_code: {
    widget: string;
    iframe: string;
  };
  instructions: {
    widget: string;
    iframe: string;
  };
  note: string;
}

interface WidgetConfig {
  id: string;
  name: string;
  layout_mode: 'floating' | 'split' | 'fullscreen';
  primary_color: string;
  secondary_color?: string;
  text_color: string;
  position: 'bottom-right' | 'bottom-left';
  width: number;
  height: number;
  border_radius: number;
  show_branding: boolean;
  auto_open: boolean;
  auto_open_desktop?: boolean;
  auto_open_mobile?: boolean;
  allowed_domains: string[];
  welcome_message?: string;
  auto_theme?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  theme_style?: 'classic' | 'modern';
  bg_color?: string;
  border_color?: string;
  input_bg_color?: string;
  input_text_color?: string;
  bg_color_dark?: string;
  text_color_dark?: string;
  border_color_dark?: string;
  input_bg_color_dark?: string;
  input_text_color_dark?: string;
  bubble_icon?: 'chat' | 'dots' | 'support' | 'ai' | 'ragleaf' | 'robot' | 'brain' | 'smile' | 'globe' | 'custom';
  custom_icon_svg?: string;
  bottom_offset?: number;
  right_offset?: number;
  left_offset?: number;
  mobile_bottom_offset?: number;
  mobile_right_offset?: number;
  mobile_left_offset?: number;
  // Module toggles managed per-widget
  appointment_module_enabled?: boolean;
  reservation_module_enabled?: boolean;
  order_module_enabled?: boolean;
  lead_module_enabled?: boolean;
}

interface AgentDetail {
  id: number;
  name: string;
  public_id: string;
  is_active: boolean;
  allowed_domains: string[] | null;
  welcome_message?: string;
  appearance?: {
    layout_mode?: 'floating' | 'split' | 'fullscreen';
    widgets?: WidgetConfig[];
    [key: string]: any;
  } | null;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('ragleaf_token');
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

const BUBBLE_ICONS: Record<string, string> = {
  chat: '<svg viewBox="0 0 24 24" class="w-6 h-6"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/></svg>',
  dots: '<svg viewBox="0 0 24 24" class="w-6 h-6"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>',
  support: '<svg viewBox="0 0 24 24" class="w-6 h-6"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12c0 2.21.72 4.25 1.94 5.92L3 21l3.08-.94C7.75 21.28 9.79 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg>',
  ai: '<svg viewBox="0 0 24 24" class="w-6 h-6"><path fill="currentColor" d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/></svg>',
  ragleaf: '<svg viewBox="0 0 24 24" class="w-6 h-6"><path fill="currentColor" d="M17 2c-3.6 0-6.6 2.2-8 5.4C7.6 4.2 4.6 2 1 2c0 0 4 4 4 8 0 4.4 3.6 8 8 8 4.4 0 8-3.6 8-8 0-4-4-8-4-8zm-4 14c-2.2 0-4-1.8-4-4 0-2.2 1.8-4 4-4s4 1.8 4 4c0 2.2-1.8 4-4 4z"/></svg>',
  robot: '<svg viewBox="0 0 24 24" class="w-6 h-6"><path fill="currentColor" d="M19 8h-1.18C17.37 5.62 14.9 4 12 4s-5.37 1.62-5.82 4H5c-1.1 0-2 .9-2 2v3c0 1.1.9 2 2 2h1.18c.45 2.38 2.92 4 5.82 4s5.37-1.62 5.82-4H19c1.1 0 2-.9 2-2v-3c0-1.1-.9-2-2-2zM8.5 13c-.83 0-1.5-.67-1.5-1.5S7.67 10 8.5 10s1.5.67 1.5 1.5S9.33 13 8.5 13zm7 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>',
  brain: '<svg viewBox="0 0 24 24" class="w-6 h-6"><path fill="currentColor" d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.9-1.9C9.07 19.58 10.47 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg>',
  smile: '<svg viewBox="0 0 24 24" class="w-6 h-6"><path fill="currentColor" d="M12 2c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10-4.48-10-10-10zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-3.5-9c-.83 0-1.5-.67-1.5-1.5S7.67 8 8.5 8s1.5.67 1.5 1.5S9.33 11 8.5 11zm7 0c-.83 0-1.5-.67-1.5-1.5S14.67 8 15.5 8s1.5.67 1.5 1.5S16.33 11 15.5 11zm-7 3c.88 1.76 2.94 3 5 3s4.12-1.24 5-3H8.5z"/></svg>',
  globe: '<svg viewBox="0 0 24 24" class="w-6 h-6"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-1 17.93a8 8 0 0 1-6.93-7h6.93zm0-9H4.07a8 8 0 0 1 6.93-7zm2-7a8 8 0 0 1 6.93 7H13zm0 14.93v-6.93h6.93a8 8 0 0 1-6.93 7z"/></svg>'
};

export default function TenantWidget() {
  const { t, language } = useTranslation();
  const [agents, setAgents] = useState<AgentDetail[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [embedCode, setEmbedCode] = useState<EmbedCodeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [codeLoading, setCodeLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [widgetPlatform, setWidgetPlatform] = useState<'html' | 'react' | 'nextjs' | 'wordpress'>('html');
  
  // Multi-widget state
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newWidgetName, setNewWidgetName] = useState('');
  
  // Edit form state (for active selected widget)
  const [widgetForm, setWidgetForm] = useState<WidgetConfig | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [colorEditMode, setColorEditMode] = useState<'light' | 'dark'>('light');

  const previewTheme = widgetForm ? (widgetForm.theme === 'auto' ? colorEditMode : (widgetForm.theme || 'light')) : 'light';


  const getMockupBubbleIcon = () => {
    if (!widgetForm) return BUBBLE_ICONS.chat;
    if (widgetForm.bubble_icon === 'custom' && widgetForm.custom_icon_svg && widgetForm.custom_icon_svg.includes('<svg')) {
      return widgetForm.custom_icon_svg.replace('<svg', '<svg class="w-6 h-6"');
    }
    const key = widgetForm.bubble_icon || 'chat';
    return BUBBLE_ICONS[key] || BUBBLE_ICONS.chat;
  };

  const handleSvgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'image/svg+xml' && !file.name.endsWith('.svg')) {
      toast.error(language === 'tr' ? 'Lütfen geçerli bir SVG dosyası seçin.' : 'Please select a valid SVG file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text.trim().startsWith('<svg')) {
        updateFormField('custom_icon_svg', text);
        toast.success(language === 'tr' ? 'SVG başarıyla yüklendi.' : 'SVG successfully uploaded.');
      } else {
        toast.error(language === 'tr' ? "Geçersiz SVG dosyası. '<svg' ile başlamalıdır." : "Invalid SVG file. Must start with '<svg'");
      }
    };
    reader.readAsText(file);
  };


  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  const [currentOrg, setCurrentOrg] = useState<any>(null);
  const isTrial = currentOrg && currentOrg.plan === 'starter' && currentOrg.trial_ends_at !== null;

  // Load agents and organization on mount
  useEffect(() => {
    Promise.all([
      fetchAPI<AgentDetail[]>('/api/org/agents'),
      fetchAPI<any>('/api/organizations/current').catch(() => null)
    ])
      .then(([a, org]) => {
        setAgents(a);
        setCurrentOrg(org);
        if (a.length > 0) {
          setSelectedAgentId(a[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Load embed code info when agent changes
  useEffect(() => {
    if (!selectedAgentId) return;
    setCodeLoading(true);
    fetchAPI<EmbedCodeResponse>(`/api/agents/${selectedAgentId}/embed-code`)
      .then(setEmbedCode)
      .catch(console.error)
      .finally(() => setCodeLoading(false));
  }, [selectedAgentId]);

  // Load widgets from selected agent's appearance field
  useEffect(() => {
    if (selectedAgent) {
      const appearanceWidgets = selectedAgent.appearance?.widgets || [];
      setWidgets(appearanceWidgets);
      
      if (appearanceWidgets.length > 0) {
        setSelectedWidgetId(appearanceWidgets[0].id);
        setWidgetForm(appearanceWidgets[0]);
      } else {
        setSelectedWidgetId(null);
        setWidgetForm(null);
      }
    }
  }, [selectedAgentId, agents]);

  // Set form values when active widget changes
  const handleWidgetSelect = (widgetId: string) => {
    setSelectedWidgetId(widgetId);
    const w = widgets.find(item => item.id === widgetId);
    if (w) setWidgetForm(w);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to generate unique widget ID
  const generateWidgetId = () => {
    return 'wdg_' + Math.random().toString(36).substr(2, 9);
  };

  // Update a field in the form local state
  const updateFormField = <K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) => {
    setWidgetForm(prev => prev ? { ...prev, [key]: value } : null);
  };

  // Save the current widget config to backend
  const saveWidgetConfig = async (updatedWidgetsList: WidgetConfig[]) => {
    if (!selectedAgentId || !selectedAgent) return;
    setIsSaving(true);
    try {
      const currentAppearance = selectedAgent.appearance || {};
      const updatedAppearance = { ...currentAppearance, widgets: updatedWidgetsList };
      
      const agent = await fetchAPI<AgentDetail>(`/api/agents/${selectedAgentId}`, {
        method: 'PUT',
        body: JSON.stringify({ appearance: updatedAppearance }),
      });
      
      // Update local agents list
      setAgents(prev => prev.map(a => a.id === agent.id ? agent : a));
      toast.success(language === 'tr' ? 'Değişiklikler başarıyla kaydedildi!' : 'Changes saved successfully!');
    } catch (err: any) {
      console.error('Widget kaydedilemedi / Widget could not be saved:', err);
      toast.error(language === 'tr' ? 'Kaydedilemedi: ' + (err.message || 'Bilinmeyen hata') : 'Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  // Triggered when form fields are modified and saved
  const handleSaveForm = async () => {
    if (!widgetForm || !selectedWidgetId) return;
    const updatedWidgets = widgets.map(w => w.id === selectedWidgetId ? widgetForm : w);
    await saveWidgetConfig(updatedWidgets);
  };

  // Add new domain tag to widgetForm
  const addDomain = () => {
    if (!newDomain.trim() || !widgetForm) return;
    const clean = newDomain.trim().toLowerCase();
    if (widgetForm.allowed_domains.includes(clean)) return;
    
    const updatedDomains = [...widgetForm.allowed_domains, clean];
    updateFormField('allowed_domains', updatedDomains);
    setNewDomain('');
  };

  // Remove domain tag
  const removeDomain = (domain: string) => {
    if (!widgetForm) return;
    const updatedDomains = widgetForm.allowed_domains.filter(d => d !== domain);
    updateFormField('allowed_domains', updatedDomains);
  };

  // Create a new widget
  const handleCreateWidget = async () => {
    if (!newWidgetName.trim() || !selectedAgent) return;
    
    const newWidget: WidgetConfig = {
      id: generateWidgetId(),
      name: newWidgetName.trim(),
      layout_mode: 'floating',
      primary_color: '#22c55e',
      secondary_color: '#8b5cf6',
      text_color: '#FFFFFF',
      position: 'bottom-right',
      width: 380,
      height: 520,
      border_radius: 16,
      show_branding: true,
      auto_open: true,
      allowed_domains: [],
      welcome_message: selectedAgent.welcome_message || 'Merhaba! Size nasıl yardımcı olabilirim?',
      auto_theme: false,
      bg_color: '#FFFFFF',
      border_color: '#E5E7EB',
      input_bg_color: '#FFFFFF',
      input_text_color: '#1F2937',
      bg_color_dark: '#090D16',
      text_color_dark: '#F3F4F6',
      border_color_dark: '#374151',
      input_bg_color_dark: '#111827',
      input_text_color_dark: '#F3F4F6',
      appointment_module_enabled: false,
      reservation_module_enabled: false,
      order_module_enabled: false,
      lead_module_enabled: false,
    };

    const updatedList = [...widgets, newWidget];
    await saveWidgetConfig(updatedList);
    
    // Select newly created widget
    setSelectedWidgetId(newWidget.id);
    setWidgetForm(newWidget);
    setNewWidgetName('');
    setShowNewModal(false);
  };

  // Delete current widget
  const handleDeleteWidget = async (widgetId: string) => {
    const trMsg = 'Bu widget\'ı silmek istediğinize emin misiniz?';
    const enMsg = 'Are you sure you want to delete this widget?';
    if (!confirm(language === 'tr' ? trMsg : enMsg)) return;

    const updatedList = widgets.filter(w => w.id !== widgetId);
    await saveWidgetConfig(updatedList);
  };

  // Reset widget configuration to defaults
  const handleResetWidgetConfig = () => {
    if (!widgetForm) return;
    const trMsg = 'Bu widget\'ın tüm görünüm ve renk ayarlarını varsayılan değerlerine sıfırlamak istediğinizden emin misiniz?';
    const enMsg = 'Are you sure you want to reset all appearance and color settings of this widget to their default values?';
    if (!confirm(language === 'tr' ? trMsg : enMsg)) return;

    setWidgetForm({
      ...widgetForm,
      layout_mode: 'floating',
      primary_color: '#22c55e',
      secondary_color: '#8b5cf6',
      text_color: '#1F2937',
      position: 'bottom-right',
      width: 380,
      height: 520,
      border_radius: 16,
      show_branding: true,
      auto_open: true,
      auto_theme: false,
      theme: 'auto',
      bg_color: '#FFFFFF',
      border_color: '#E5E7EB',
      input_bg_color: '#FFFFFF',
      input_text_color: '#1F2937',
      bg_color_dark: '#090D16',
      text_color_dark: '#F3F4F6',
      border_color_dark: '#374151',
      input_bg_color_dark: '#111827',
      input_text_color_dark: '#F3F4F6',
    });
    
    setColorEditMode('light');
  };

  // Generate widget script code dynamically
  const getCustomWidgetCode = (w: WidgetConfig) => {
    if (!embedCode) return '';
    const baseCode = embedCode.embed_code.widget;
    
    // Replace default primary color and position, and inject widget-id
    let parsed = baseCode
      .replace(/data-primary-color="[^"]*"/, `data-primary-color="${w.primary_color}"\n  data-secondary-color="${w.secondary_color || '#8b5cf6'}"`)
      .replace(/data-position="[^"]*"/, `data-position="${w.position}"`);
      
    if (w.bottom_offset !== undefined) parsed = parsed.replace('async', `data-bottom-offset="${w.bottom_offset}"\n  async`);
    if (w.right_offset !== undefined) parsed = parsed.replace('async', `data-right-offset="${w.right_offset}"\n  async`);
    if (w.left_offset !== undefined) parsed = parsed.replace('async', `data-left-offset="${w.left_offset}"\n  async`);
    if (w.mobile_bottom_offset !== undefined) parsed = parsed.replace('async', `data-mobile-bottom-offset="${w.mobile_bottom_offset}"\n  async`);
    if (w.mobile_right_offset !== undefined) parsed = parsed.replace('async', `data-mobile-right-offset="${w.mobile_right_offset}"\n  async`);
    if (w.mobile_left_offset !== undefined) parsed = parsed.replace('async', `data-mobile-left-offset="${w.mobile_left_offset}"\n  async`);
      
    if (parsed.includes('async')) {
      parsed = parsed.replace('async', `data-widget-id="${w.id}"\n  async`);
    }
    return parsed;
  };

  const getCustomPlatformWidgetCode = (w: WidgetConfig, platform: 'html' | 'react' | 'nextjs' | 'wordpress') => {
    if (!embedCode) return '';
    
    const baseUrl = API_BASE || window.location.origin;
    const agentPublicId = embedCode.public_id;
    const apiKeyPrefix = embedCode.api_key_prefix;
    const primaryColor = w.primary_color;
    const position = w.position;
    const widgetId = w.id;
    const title = w.name || selectedAgent?.name || 'Ragleaf';
    const forceBranding = isTrial || w.show_branding !== false;
    const autoThemeAttr = w.auto_theme ? `\n    script.setAttribute('data-auto-theme', 'true');` : '';
    const themeAttr = w.theme ? `\n    script.setAttribute('data-theme', '${w.theme}');` : '';
    const secondaryColorAttr = `\n    script.setAttribute('data-secondary-color', '${w.secondary_color || '#8b5cf6'}');`;
    const showBrandingAttr = !forceBranding ? `\n    script.setAttribute('data-show-branding', 'false');` : '';
    const bgColorAttr = !w.auto_theme && w.bg_color ? `\n    script.setAttribute('data-bg-color', '${w.bg_color}');` : '';
    const textColorAttr = !w.auto_theme && w.text_color ? `\n    script.setAttribute('data-text-color', '${w.text_color}');` : '';
    const borderColorAttr = !w.auto_theme && w.border_color ? `\n    script.setAttribute('data-border-color', '${w.border_color}');` : '';
    const inputBgColorAttr = !w.auto_theme && w.input_bg_color ? `\n    script.setAttribute('data-input-bg-color', '${w.input_bg_color}');` : '';
    const inputTextColorAttr = !w.auto_theme && w.input_text_color ? `\n    script.setAttribute('data-input-text-color', '${w.input_text_color}');` : '';
    
    const bgColorDarkAttr = !w.auto_theme && w.bg_color_dark ? `\n    script.setAttribute('data-bg-color-dark', '${w.bg_color_dark}');` : '';
    const textColorDarkAttr = !w.auto_theme && w.text_color_dark ? `\n    script.setAttribute('data-text-color-dark', '${w.text_color_dark}');` : '';
    const borderColorDarkAttr = !w.auto_theme && w.border_color_dark ? `\n    script.setAttribute('data-border-color-dark', '${w.border_color_dark}');` : '';
    const inputBgColorDarkAttr = !w.auto_theme && w.input_bg_color_dark ? `\n    script.setAttribute('data-input-bg-color-dark', '${w.input_bg_color_dark}');` : '';
    const inputTextColorDarkAttr = !w.auto_theme && w.input_text_color_dark ? `\n    script.setAttribute('data-input-text-color-dark', '${w.input_text_color_dark}');` : '';
    const themeStyleAttr = `\n    script.setAttribute('data-theme-style', '${w.theme_style || 'classic'}');`;

    const bottomOffsetAttr = w.bottom_offset !== undefined ? `\n    script.setAttribute('data-bottom-offset', '${w.bottom_offset}');` : '';
    const rightOffsetAttr = w.right_offset !== undefined ? `\n    script.setAttribute('data-right-offset', '${w.right_offset}');` : '';
    const leftOffsetAttr = w.left_offset !== undefined ? `\n    script.setAttribute('data-left-offset', '${w.left_offset}');` : '';
    const mobileBottomOffsetAttr = w.mobile_bottom_offset !== undefined ? `\n    script.setAttribute('data-mobile-bottom-offset', '${w.mobile_bottom_offset}');` : '';
    const mobileRightOffsetAttr = w.mobile_right_offset !== undefined ? `\n    script.setAttribute('data-mobile-right-offset', '${w.mobile_right_offset}');` : '';
    const mobileLeftOffsetAttr = w.mobile_left_offset !== undefined ? `\n    script.setAttribute('data-mobile-left-offset', '${w.mobile_left_offset}');` : '';

    const autoThemeNextAttr = w.auto_theme ? `\n          data-auto-theme="true"` : '';
    const themeNextAttr = w.theme ? `\n          data-theme="${w.theme}"` : '';
    const secondaryColorNextAttr = `\n          data-secondary-color="${w.secondary_color || '#8b5cf6'}"`;
    const showBrandingNextAttr = !forceBranding ? `\n          data-show-branding="false"` : '';
    const bgColorNextAttr = !w.auto_theme && w.bg_color ? `\n          data-bg-color="${w.bg_color}"` : '';
    const textColorNextAttr = !w.auto_theme && w.text_color ? `\n          data-text-color="${w.text_color}"` : '';
    const borderColorNextAttr = !w.auto_theme && w.border_color ? `\n          data-border-color="${w.border_color}"` : '';
    const inputBgColorNextAttr = !w.auto_theme && w.input_bg_color ? `\n          data-input-bg-color="${w.input_bg_color}"` : '';
    const inputTextColorNextAttr = !w.auto_theme && w.input_text_color ? `\n          data-input-text-color="${w.input_text_color}"` : '';
    const bgColorDarkNextAttr = !w.auto_theme && w.bg_color_dark ? `\n          data-bg-color-dark="${w.bg_color_dark}"` : '';
    const textColorDarkNextAttr = !w.auto_theme && w.text_color_dark ? `\n          data-text-color-dark="${w.text_color_dark}"` : '';
    const borderColorDarkNextAttr = !w.auto_theme && w.border_color_dark ? `\n          data-border-color-dark="${w.border_color_dark}"` : '';
    const inputBgColorDarkNextAttr = !w.auto_theme && w.input_bg_color_dark ? `\n          data-input-bg-color-dark="${w.input_bg_color_dark}"` : '';
    const inputTextColorDarkNextAttr = !w.auto_theme && w.input_text_color_dark ? `\n          data-input-text-color-dark="${w.input_text_color_dark}"` : '';
    const themeStyleNextAttr = `\n          data-theme-style="${w.theme_style || 'classic'}"`;

    const bottomOffsetNextAttr = w.bottom_offset !== undefined ? `\n          data-bottom-offset="${w.bottom_offset}"` : '';
    const rightOffsetNextAttr = w.right_offset !== undefined ? `\n          data-right-offset="${w.right_offset}"` : '';
    const leftOffsetNextAttr = w.left_offset !== undefined ? `\n          data-left-offset="${w.left_offset}"` : '';
    const mobileBottomOffsetNextAttr = w.mobile_bottom_offset !== undefined ? `\n          data-mobile-bottom-offset="${w.mobile_bottom_offset}"` : '';
    const mobileRightOffsetNextAttr = w.mobile_right_offset !== undefined ? `\n          data-mobile-right-offset="${w.mobile_right_offset}"` : '';
    const mobileLeftOffsetNextAttr = w.mobile_left_offset !== undefined ? `\n          data-mobile-left-offset="${w.mobile_left_offset}"` : '';

    const autoThemeWPAttr = w.auto_theme ? `\n    data-auto-theme="true"` : '';
    const themeWPAttr = w.theme ? `\n    data-theme="${w.theme}"` : '';
    const secondaryColorWPAttr = `\n    data-secondary-color="${w.secondary_color || '#8b5cf6'}"`;
    const showBrandingWPAttr = !forceBranding ? `\n    data-show-branding="false"` : '';
    const bgColorWPAttr = !w.auto_theme && w.bg_color ? `\n    data-bg-color="${w.bg_color}"` : '';
    const textColorWPAttr = !w.auto_theme && w.text_color ? `\n    data-text-color="${w.text_color}"` : '';
    const borderColorWPAttr = !w.auto_theme && w.border_color ? `\n    data-border-color="${w.border_color}"` : '';
    const inputBgColorWPAttr = !w.auto_theme && w.input_bg_color ? `\n    data-input-bg-color="${w.input_bg_color}"` : '';
    const inputTextColorWPAttr = !w.auto_theme && w.input_text_color ? `\n    data-input-text-color="${w.input_text_color}"` : '';
    const bgColorDarkWPAttr = !w.auto_theme && w.bg_color_dark ? `\n    data-bg-color-dark="${w.bg_color_dark}"` : '';
    const textColorDarkWPAttr = !w.auto_theme && w.text_color_dark ? `\n    data-text-color-dark="${w.text_color_dark}"` : '';
    const borderColorDarkWPAttr = !w.auto_theme && w.border_color_dark ? `\n    data-border-color-dark="${w.border_color_dark}"` : '';
    const inputBgColorDarkWPAttr = !w.auto_theme && w.input_bg_color_dark ? `\n    data-input-bg-color-dark="${w.input_bg_color_dark}"` : '';
    const inputTextColorDarkWPAttr = !w.auto_theme && w.input_text_color_dark ? `\n    data-input-text-color-dark="${w.input_text_color_dark}"` : '';
    const themeStyleWPAttr = `\n    data-theme-style="${w.theme_style || 'classic'}"`;

    const bottomOffsetWPAttr = w.bottom_offset !== undefined ? `\n    data-bottom-offset="${w.bottom_offset}"` : '';
    const rightOffsetWPAttr = w.right_offset !== undefined ? `\n    data-right-offset="${w.right_offset}"` : '';
    const leftOffsetWPAttr = w.left_offset !== undefined ? `\n    data-left-offset="${w.left_offset}"` : '';
    const mobileBottomOffsetWPAttr = w.mobile_bottom_offset !== undefined ? `\n    data-mobile-bottom-offset="${w.mobile_bottom_offset}"` : '';
    const mobileRightOffsetWPAttr = w.mobile_right_offset !== undefined ? `\n    data-mobile-right-offset="${w.mobile_right_offset}"` : '';
    const mobileLeftOffsetWPAttr = w.mobile_left_offset !== undefined ? `\n    data-mobile-left-offset="${w.mobile_left_offset}"` : '';

    const autoThemeHTMLAttr = w.auto_theme ? `\n  data-auto-theme="true"` : '';
    const themeHTMLAttr = w.theme ? `\n  data-theme="${w.theme}"` : '';
    const secondaryColorHTMLAttr = `\n  data-secondary-color="${w.secondary_color || '#8b5cf6'}"`;
    const showBrandingHTMLAttr = !forceBranding ? `\n  data-show-branding="false"` : '';
    const bgColorHTMLAttr = !w.auto_theme && w.bg_color ? `\n  data-bg-color="${w.bg_color}"` : '';
    const textColorHTMLAttr = !w.auto_theme && w.text_color ? `\n  data-text-color="${w.text_color}"` : '';
    const borderColorHTMLAttr = !w.auto_theme && w.border_color ? `\n  data-border-color="${w.border_color}"` : '';
    const inputBgColorHTMLAttr = !w.auto_theme && w.input_bg_color ? `\n  data-input-bg-color="${w.input_bg_color}"` : '';
    const inputTextColorHTMLAttr = !w.auto_theme && w.input_text_color ? `\n  data-input-text-color="${w.input_text_color}"` : '';
    const bgColorDarkHTMLAttr = !w.auto_theme && w.bg_color_dark ? `\n  data-bg-color-dark="${w.bg_color_dark}"` : '';
    const textColorDarkHTMLAttr = !w.auto_theme && w.text_color_dark ? `\n  data-text-color-dark="${w.text_color_dark}"` : '';
    const borderColorDarkHTMLAttr = !w.auto_theme && w.border_color_dark ? `\n  data-border-color-dark="${w.border_color_dark}"` : '';
    const inputBgColorDarkHTMLAttr = !w.auto_theme && w.input_bg_color_dark ? `\n  data-input-bg-color-dark="${w.input_bg_color_dark}"` : '';
    const inputTextColorDarkHTMLAttr = !w.auto_theme && w.input_text_color_dark ? `\n  data-input-text-color-dark="${w.input_text_color_dark}"` : '';
    const themeStyleHTMLAttr = `\n  data-theme-style="${w.theme_style || 'classic'}"`;

    const bottomOffsetHTMLAttr = w.bottom_offset !== undefined ? `\n  data-bottom-offset="${w.bottom_offset}"` : '';
    const rightOffsetHTMLAttr = w.right_offset !== undefined ? `\n  data-right-offset="${w.right_offset}"` : '';
    const leftOffsetHTMLAttr = w.left_offset !== undefined ? `\n  data-left-offset="${w.left_offset}"` : '';
    const mobileBottomOffsetHTMLAttr = w.mobile_bottom_offset !== undefined ? `\n  data-mobile-bottom-offset="${w.mobile_bottom_offset}"` : '';
    const mobileRightOffsetHTMLAttr = w.mobile_right_offset !== undefined ? `\n  data-mobile-right-offset="${w.mobile_right_offset}"` : '';
    const mobileLeftOffsetHTMLAttr = w.mobile_left_offset !== undefined ? `\n  data-mobile-left-offset="${w.mobile_left_offset}"` : '';

    const extraAttrs = `${autoThemeAttr}${themeAttr}${secondaryColorAttr}${showBrandingAttr}${bgColorAttr}${textColorAttr}${borderColorAttr}${inputBgColorAttr}${inputTextColorAttr}${bgColorDarkAttr}${textColorDarkAttr}${borderColorDarkAttr}${inputBgColorDarkAttr}${inputTextColorDarkAttr}${themeStyleAttr}${bottomOffsetAttr}${rightOffsetAttr}${leftOffsetAttr}${mobileBottomOffsetAttr}${mobileRightOffsetAttr}${mobileLeftOffsetAttr}`;
    const extraNextAttrs = `${autoThemeNextAttr}${themeNextAttr}${secondaryColorNextAttr}${showBrandingNextAttr}${bgColorNextAttr}${textColorNextAttr}${borderColorNextAttr}${inputBgColorNextAttr}${inputTextColorNextAttr}${bgColorDarkNextAttr}${textColorDarkNextAttr}${borderColorDarkNextAttr}${inputBgColorDarkNextAttr}${inputTextColorDarkNextAttr}${themeStyleNextAttr}${bottomOffsetNextAttr}${rightOffsetNextAttr}${leftOffsetNextAttr}${mobileBottomOffsetNextAttr}${mobileRightOffsetNextAttr}${mobileLeftOffsetNextAttr}`;
    const extraWPAttrs = `${autoThemeWPAttr}${themeWPAttr}${secondaryColorWPAttr}${showBrandingWPAttr}${bgColorWPAttr}${textColorWPAttr}${borderColorWPAttr}${inputBgColorWPAttr}${inputTextColorWPAttr}${bgColorDarkWPAttr}${textColorDarkWPAttr}${borderColorDarkWPAttr}${inputBgColorDarkWPAttr}${inputTextColorDarkWPAttr}${themeStyleWPAttr}${bottomOffsetWPAttr}${rightOffsetWPAttr}${leftOffsetWPAttr}${mobileBottomOffsetWPAttr}${mobileRightOffsetWPAttr}${mobileLeftOffsetWPAttr}`;
    const extraHTMLAttrs = `${autoThemeHTMLAttr}${themeHTMLAttr}${secondaryColorHTMLAttr}${showBrandingHTMLAttr}${bgColorHTMLAttr}${textColorHTMLAttr}${borderColorHTMLAttr}${inputBgColorHTMLAttr}${inputTextColorHTMLAttr}${bgColorDarkHTMLAttr}${textColorDarkHTMLAttr}${borderColorDarkHTMLAttr}${inputBgColorDarkHTMLAttr}${inputTextColorDarkHTMLAttr}${themeStyleHTMLAttr}${bottomOffsetHTMLAttr}${rightOffsetHTMLAttr}${leftOffsetHTMLAttr}${mobileBottomOffsetHTMLAttr}${mobileRightOffsetHTMLAttr}${mobileLeftOffsetHTMLAttr}`;


    switch (platform) {
      case 'react':
        return `import { useEffect } from 'react';

export default function RagleafAssistant() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '${baseUrl}/widget.js';
    script.setAttribute('data-agent-id', '${agentPublicId}');
    script.setAttribute('data-api-key', '${apiKeyPrefix}');
    script.setAttribute('data-api-url', '${baseUrl}');
    script.setAttribute('data-primary-color', '${primaryColor}');
    script.setAttribute('data-position', '${position}');
    script.setAttribute('data-title', '${title}');
    script.setAttribute('data-widget-id', '${widgetId}');${extraAttrs}
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
      const host = document.getElementById('ragleaf-widget-host');
      if (host) host.remove();
    };
  }, []);

  return null;
}`;
      case 'nextjs':
        return `import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>
        {children}
        <Script
          src="${baseUrl}/widget.js"
          data-agent-id="${agentPublicId}"
          data-api-key="${apiKeyPrefix}"
          data-api-url="${baseUrl}"
          data-primary-color="${primaryColor}"
          data-position="${position}"
          data-title="${title}"
          data-widget-id="${widgetId}"${extraNextAttrs}
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}`;
      case 'wordpress':
        return `// WordPress temasınızın functions.php dosyasının en altına ekleyin:
add_action('wp_footer', function() {
  echo '<script
    src="${baseUrl}/widget.js"
    data-agent-id="${agentPublicId}"
    data-api-key="${apiKeyPrefix}"
    data-api-url="${baseUrl}"
    data-primary-color="${primaryColor}"
    data-position="${position}"
    data-title="${title}"
    data-widget-id="${widgetId}"${extraWPAttrs}
    async
  ></script>';
});`;
      case 'html':
      default:
        return `<script
  src="${baseUrl}/widget.js"
  data-agent-id="${agentPublicId}"
  data-api-key="${apiKeyPrefix}"
  data-api-url="${baseUrl}"
  data-primary-color="${primaryColor}"
  data-position="${position}"
  data-title="${title}"
  data-widget-id="${widgetId}"${extraHTMLAttrs}
  async
></script>`;
    }
  };

  // Generate iframe code dynamically
  const getCustomIframeCode = (w: WidgetConfig) => {
    if (!embedCode) return '';
    const baseCode = embedCode.embed_code.iframe;
    // Append widget_id query parameter
    return baseCode.replace(`/chat/${embedCode.public_id}`, `/chat/${embedCode.public_id}?widget_id=${w.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">
          <span className="text-primary-500">AI</span>chat / {language === 'tr' ? 'Widget\'ler' : 'Widgets'}
        </h1>
        <p className="text-gray-500 mt-1">{t('widget.subtitle')}</p>
      </div>

      {agents.length === 0 ? (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 text-center">
          <p className="text-amber-400">{t('widget.no_agents')}</p>
          <a href="/agents" className="text-primary-400 hover:underline mt-2 inline-block">{t('widget.btn_create_agent')}</a>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Left Column: Unified Sidebar (Width 1/4) */}
          <div className="lg:col-span-1">
            <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.2)] flex flex-col gap-6 backdrop-blur-md">
              {/* Agent Selector Section */}
              <div className="flex flex-col gap-3">
                <h3 className="font-bold text-xs text-gray-400 tracking-wider uppercase flex items-center gap-2 border-b border-white/[0.06] pb-2">
                  <span>🤖</span> {language === 'tr' ? 'Asistan Seçimi' : 'Select Assistant'}
                </h3>
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {agents.map((a) => {
                    const widgetCount = a.appearance?.widgets?.length || 0;
                    const isActive = selectedAgentId === a.id;
                    return (
                      <div
                        key={a.id}
                        onClick={() => setSelectedAgentId(a.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          isActive
                            ? 'border-primary-500 bg-primary-500/10 shadow-[0_0_15px_rgba(34,197,94,0.1)]'
                            : 'border-white/[0.06] hover:bg-dark-700/50 bg-dark-800/40'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                          isActive ? 'bg-primary-500 text-dark-900' : 'bg-dark-700 text-gray-300'
                        }`}>
                          {a.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-gray-200 truncate">{a.name}</p>
                            <span className={`w-1.5 h-1.5 rounded-full ${a.is_active ? 'bg-green-500' : 'bg-gray-600'}`} />
                          </div>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {widgetCount} {language === 'tr' ? 'Widget' : 'Widgets'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-white/[0.06]" />

              {/* Widgets List Section */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <h3 className="font-bold text-xs text-gray-400 tracking-wider uppercase flex items-center gap-2">
                    <span>💬</span> {language === 'tr' ? 'Widget\'lar' : 'Widgets'}
                  </h3>
                  <button
                    onClick={() => setShowNewModal(true)}
                    className="px-2 py-0.5 bg-primary-600 hover:bg-primary-700 text-white text-[10px] font-semibold rounded transition"
                  >
                    + {language === 'tr' ? 'Yeni' : 'New'}
                  </button>
                </div>

                {widgets.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-white/[0.06] rounded-xl bg-dark-700/20">
                    <p className="text-xs text-gray-500">
                      {language === 'tr' 
                        ? 'Bu asistan için oluşturulmuş bir widget bulunamadı.' 
                        : 'No widgets found for this assistant.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {widgets.map((w) => {
                      const isActive = selectedWidgetId === w.id;
                      const layoutText = w.layout_mode === 'floating' ? 'Floating' : w.layout_mode === 'split' ? 'Split' : 'Fullscreen';
                      const layoutIcon = w.layout_mode === 'floating' ? '💬' : w.layout_mode === 'split' ? '📱' : '🖥️';
                      return (
                        <div
                          key={w.id}
                          onClick={() => handleWidgetSelect(w.id)}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            isActive
                              ? 'border-primary-500 bg-primary-500/10 shadow-[0_0_15px_rgba(34,197,94,0.1)]'
                              : 'border-white/[0.06] hover:bg-dark-700/50 bg-dark-800/40'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors ${
                            isActive ? 'bg-primary-500 text-dark-900' : 'bg-dark-700 text-gray-300'
                          }`}>
                            {layoutIcon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-gray-200 truncate">{w.name}</p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteWidget(w.id);
                                }}
                                className="text-gray-500 hover:text-red-500 p-1 rounded transition-colors"
                                title={language === 'tr' ? 'Widget\'ı Sil' : 'Delete Widget'}
                              >
                                ✕
                              </button>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span 
                                className="w-2.5 h-2.5 rounded-full border border-white/20"
                                style={{ backgroundColor: w.primary_color || '#22c55e' }}
                              />
                              <p className="text-[10px] text-gray-500 font-mono truncate max-w-[80px]">{w.id}</p>
                              <span className="text-[9px] px-1.5 py-0.5 bg-dark-600 border border-white/[0.06] rounded text-gray-400 font-semibold">
                                {layoutText}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Customization, Preview & Embed Code (Width 3/4) */}
          <div className="lg:col-span-3 space-y-6">
            {widgetForm && selectedWidgetId ? (
              <>
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                  
                  {/* Left Side: Form Config (xl:col-span-2) */}
                  <div className="xl:col-span-2 space-y-6 flex flex-col">
                    
                    {/* Header Card */}
                    <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.2)] flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-gray-200">
                          ⚙️ {language === 'tr' ? 'Widget Konfigürasyonu' : 'Widget Configuration'}
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {widgetForm.name} ({widgetForm.id})
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleResetWidgetConfig}
                          className="px-4 py-2 bg-dark-900 hover:bg-dark-700 text-red-400 hover:text-red-300 text-xs font-bold rounded-lg border border-red-500/20 transition"
                        >
                          {language === 'tr' ? 'Sıfırla' : 'Reset'}
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveForm}
                          disabled={isSaving}
                          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
                        >
                          {isSaving ? '...' : (language === 'tr' ? 'Kaydet' : 'Save')}
                        </button>
                      </div>
                    </div>

                    {/* Card 1: Genel Ayarlar */}
                    <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.2)] space-y-4">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/[0.06] pb-2">
                        📋 Genel Ayarlar
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Widget Adı</label>
                          <input
                            type="text"
                            value={widgetForm.name}
                            onChange={(e) => updateFormField('name', e.target.value)}
                            className="w-full px-3.5 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-sm text-gray-200 outline-none transition"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Karşılama Mesajı</label>
                          <input
                            type="text"
                            value={widgetForm.welcome_message || ''}
                            onChange={(e) => updateFormField('welcome_message', e.target.value)}
                            className="w-full px-3.5 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-sm text-gray-200 outline-none transition"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Yerleşim Ayarları */}
                    <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.2)] space-y-4">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/[0.06] pb-2">
                        📐 Yerleşim Ayarları
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Görünüm Modu</label>
                          <select
                            value={widgetForm.layout_mode}
                            onChange={(e) => updateFormField('layout_mode', e.target.value as any)}
                            className="w-full px-3 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-xs text-gray-200 outline-none"
                          >
                            <option value="floating">{t('widget.layout_floating')}</option>
                            <option value="split">{t('widget.layout_split')}</option>
                            <option value="fullscreen">{t('widget.layout_fullscreen')}</option>
                          </select>
                        </div>
                        
                        {widgetForm.layout_mode !== 'fullscreen' && (
                          <>
                            <div>
                              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Konum</label>
                              <select
                                value={(widgetForm.position as string) === 'left' ? 'bottom-left' : ((widgetForm.position as string) === 'right' ? 'bottom-right' : widgetForm.position)}
                                onChange={(e) => updateFormField('position', e.target.value as any)}
                                className="w-full px-3 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-xs text-gray-200 outline-none"
                              >
                                <option value="bottom-right">{t('builder.pos_right')}</option>
                                <option value="bottom-left">{t('builder.pos_left')}</option>
                              </select>
                            </div>
                            
                            <div>
                              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Aşağıdan Uzaklık (px)</label>
                              <input
                                type="number"
                                value={widgetForm.bottom_offset !== undefined ? widgetForm.bottom_offset : 70}
                                onChange={(e) => updateFormField('bottom_offset', parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-xs text-gray-200 outline-none"
                              />
                            </div>

                            {((widgetForm.position as string) === 'bottom-right' || (widgetForm.position as string) === 'right' || !widgetForm.position) ? (
                              <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Sağdan Uzaklık (px)</label>
                                <input
                                  type="number"
                                  value={widgetForm.right_offset !== undefined ? widgetForm.right_offset : 24}
                                  onChange={(e) => updateFormField('right_offset', parseInt(e.target.value) || 0)}
                                  className="w-full px-3 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-xs text-gray-200 outline-none"
                                />
                              </div>
                            ) : (
                              <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Soldan Uzaklık (px)</label>
                                <input
                                  type="number"
                                  value={widgetForm.left_offset !== undefined ? widgetForm.left_offset : 24}
                                  onChange={(e) => updateFormField('left_offset', parseInt(e.target.value) || 0)}
                                  className="w-full px-3 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-xs text-gray-200 outline-none"
                                />
                              </div>
                            )}

                            <div>
                              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Mobilde Aşağıdan Uzaklık (px)</label>
                              <input
                                type="number"
                                value={widgetForm.mobile_bottom_offset !== undefined ? widgetForm.mobile_bottom_offset : 16}
                                onChange={(e) => updateFormField('mobile_bottom_offset', parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-xs text-gray-200 outline-none"
                              />
                            </div>

                            {((widgetForm.position as string) === 'bottom-right' || (widgetForm.position as string) === 'right' || !widgetForm.position) ? (
                              <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Mobilde Sağdan Uzaklık (px)</label>
                                <input
                                  type="number"
                                  value={widgetForm.mobile_right_offset !== undefined ? widgetForm.mobile_right_offset : 16}
                                  onChange={(e) => updateFormField('mobile_right_offset', parseInt(e.target.value) || 0)}
                                  className="w-full px-3 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-xs text-gray-200 outline-none"
                                />
                              </div>
                            ) : (
                              <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Mobilde Soldan Uzaklık (px)</label>
                                <input
                                  type="number"
                                  value={widgetForm.mobile_left_offset !== undefined ? widgetForm.mobile_left_offset : 16}
                                  onChange={(e) => updateFormField('mobile_left_offset', parseInt(e.target.value) || 0)}
                                  className="w-full px-3 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-xs text-gray-200 outline-none"
                                />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Card 3: Görünüm Ayarları */}
                    {widgetForm.layout_mode !== 'fullscreen' && (
                      <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.2)] space-y-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/[0.06] pb-2">
                          ✨ Görünüm Ayarları
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Genişlik (px)</label>
                            <input
                              type="number"
                              value={widgetForm.width}
                              onChange={(e) => updateFormField('width', parseInt(e.target.value) || 380)}
                              className="w-full px-3 py-1.5 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-xs text-gray-200 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Yükseklik (px)</label>
                            <input
                              type="number"
                              value={widgetForm.height}
                              onChange={(e) => updateFormField('height', parseInt(e.target.value) || 520)}
                              className="w-full px-3 py-1.5 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-xs text-gray-200 outline-none"
                            />
                          </div>
                        </div>
                        
                        <div className="pt-2">
                          <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Köşe Yuvarlama ({widgetForm.border_radius}px)</label>
                          <input
                            type="range"
                            min="0"
                            max="24"
                            value={widgetForm.border_radius}
                            onChange={(e) => updateFormField('border_radius', parseInt(e.target.value) || 0)}
                            className="w-full accent-primary-500 bg-dark-900 rounded-lg cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

                    {/* Card 4: Davranış Ayarları */}
                    <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.2)] space-y-4">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/[0.06] pb-2">
                        ⚡ {language === 'tr' ? 'Davranış Ayarları' : 'Behavior Settings'}
                      </h4>
                      <div className="flex flex-wrap gap-6">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={widgetForm.auto_open_desktop !== undefined ? widgetForm.auto_open_desktop : widgetForm.auto_open}
                            onChange={(e) => {
                              updateFormField('auto_open_desktop', e.target.checked);
                              updateFormField('auto_open', e.target.checked);
                            }}
                            className="rounded border-white/[0.06] bg-dark-900 text-primary-600 focus:ring-0"
                          />
                          <span className="text-xs text-gray-300">
                            {language === 'tr' ? 'Masaüstünde Otomatik Aç' : 'Auto-Open on Desktop'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={widgetForm.auto_open_mobile !== undefined ? widgetForm.auto_open_mobile : widgetForm.auto_open}
                            onChange={(e) => updateFormField('auto_open_mobile', e.target.checked)}
                            className="rounded border-white/[0.06] bg-dark-900 text-primary-600 focus:ring-0"
                          />
                          <span className="text-xs text-gray-300">
                            {language === 'tr' ? 'Mobilde Otomatik Aç' : 'Auto-Open on Mobile'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={widgetForm.show_branding}
                            onChange={(e) => updateFormField('show_branding', e.target.checked)}
                            className="rounded border-white/[0.06] bg-dark-900 text-primary-600 focus:ring-0"
                          />
                          <span className="text-xs text-gray-300">
                            {language === 'tr' ? 'Ragleaf AIChat Yazısını Göster' : 'Show Ragleaf AIChat branding'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card 4.5: Aktif Modüller */}
                    <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.2)] space-y-4">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/[0.06] pb-2">
                        🧩 {language === 'tr' ? 'Aktif Modüller' : 'Active Modules'}
                      </h4>
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!widgetForm.appointment_module_enabled}
                            onChange={(e) => updateFormField('appointment_module_enabled', e.target.checked)}
                            className="rounded border-white/[0.06] bg-dark-900 text-primary-600 focus:ring-0"
                          />
                          <span className="text-xs text-gray-300">
                            {language === 'tr' ? 'Randevu (Görüşme & Seans)' : 'Appointments (Sessions)'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!widgetForm.reservation_module_enabled}
                            onChange={(e) => updateFormField('reservation_module_enabled', e.target.checked)}
                            className="rounded border-white/[0.06] bg-dark-900 text-primary-600 focus:ring-0"
                          />
                          <span className="text-xs text-gray-300">
                            {language === 'tr' ? 'Rezervasyon (Masa & Yer)' : 'Reservations (Tables)'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!widgetForm.order_module_enabled}
                            onChange={(e) => updateFormField('order_module_enabled', e.target.checked)}
                            className="rounded border-white/[0.06] bg-dark-900 text-primary-600 focus:ring-0"
                          />
                          <span className="text-xs text-gray-300">
                            {language === 'tr' ? 'Ürün Siparişi' : 'Product Ordering'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!widgetForm.lead_module_enabled}
                            onChange={(e) => updateFormField('lead_module_enabled', e.target.checked)}
                            className="rounded border-white/[0.06] bg-dark-900 text-primary-600 focus:ring-0"
                          />
                          <span className="text-xs text-gray-300">
                            {language === 'tr' ? 'Müşteri Kayıt & Lead' : 'Lead Generation'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card 5: Domain Security */}
                    <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.2)] space-y-4">
                      <h4 className="text-sm font-semibold text-gray-200 flex items-center gap-2 border-b border-white/[0.06] pb-2">
                        <span>🔒</span> {t('widget.sec_title')}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {widgetForm.allowed_domains.length === 0 ? (
                          <p className="text-xs text-red-400">{t('widget.sec_unprotected')}</p>
                        ) : (
                          widgetForm.allowed_domains.map((d) => (
                            <span key={d} className="inline-flex items-center gap-1 px-2.5 py-1 bg-dark-600 border border-white/[0.06] rounded-md text-xs text-gray-300">
                              🌐 {d}
                              <button
                                onClick={() => removeDomain(d)}
                                className="text-gray-400 hover:text-red-500 transition ml-1 text-xs"
                              >
                                ×
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newDomain}
                          onChange={(e) => setNewDomain(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addDomain()}
                          placeholder={t('widget.add_domain_placeholder')}
                          className="flex-1 border border-white/[0.1] bg-dark-900 text-gray-100 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                        <button
                          onClick={addDomain}
                          disabled={!newDomain.trim()}
                          className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700 disabled:opacity-50 transition"
                        >
                          {t('widget.btn_add_domain')}
                        </button>
                      </div>
                    </div>

                    {/* Card 6: Satış Ortaklığı (Affiliate Programı) */}
                    <div className="bg-gradient-to-br from-dark-800/60 to-primary-950/20 rounded-xl border border-primary-500/10 p-6 shadow-[0_8px_32px_rgba(34,197,94,0.05)] space-y-4">
                      <h4 className="text-sm font-semibold text-gray-200 flex items-center justify-between border-b border-white/[0.06] pb-2">
                        <span className="flex items-center gap-2">
                          <span>🍃</span> {language === 'tr' ? 'Satış Ortaklığı (Affiliate)' : 'Affiliate Program'}
                        </span>
                        <span className="text-[10px] bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded-full font-mono font-bold animate-pulse">
                          {currentOrg?.ragleaf_leaves || 0} {language === 'tr' ? 'Yaprak' : 'Leaves'}
                        </span>
                      </h4>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        {language === 'tr' ? (
                          'Widget üzerindeki Ragleaf logosuna tıklayan her ziyaretçi için yaprak kazanın. Kazandığınız yaprakları aylık limitlerinizi artırmak veya ek özellikler almak için kullanabilirsiniz.'
                        ) : (
                          'Earn leaves for every visitor who clicks the Ragleaf logo on your widget. You can use your leaves to increase your monthly limits or purchase extra features.'
                        )}
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                        <div className="bg-dark-900/60 border border-white/[0.04] p-2.5 rounded-lg">
                          <span className="text-gray-500 block mb-0.5">{language === 'tr' ? 'Tıklama Başına' : 'Per Click'}</span>
                          <span className="text-primary-400 font-bold text-xs">+1 {language === 'tr' ? 'Yaprak' : 'Leaf'}</span>
                        </div>
                        <div className="bg-dark-900/60 border border-white/[0.04] p-2.5 rounded-lg">
                          <span className="text-gray-500 block mb-0.5">{language === 'tr' ? 'Üye Olursa' : 'Per Signup'}</span>
                          <span className="text-primary-400 font-bold text-xs">+50 {language === 'tr' ? 'Yaprak' : 'Leaves'}</span>
                        </div>
                        <div className="bg-dark-900/60 border border-white/[0.04] p-2.5 rounded-lg">
                          <span className="text-gray-500 block mb-0.5">{language === 'tr' ? 'Abonelik' : 'Subscription'}</span>
                          <span className="text-primary-400 font-bold text-xs">{language === 'tr' ? 'Paket Değeri kadar' : 'Plan Value'}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] text-gray-400 font-medium">{language === 'tr' ? 'Referans Bağlantınız' : 'Your Referral Link'}</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={`https://ragleaf.com/?ref=${currentOrg?.id || ''}`}
                            className="flex-1 text-xs bg-dark-900 border border-white/[0.08] rounded-lg px-3 py-1.5 text-gray-300 outline-none select-all focus:border-primary-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(`https://ragleaf.com/?ref=${currentOrg?.id || ''}`);
                              toast.success(language === 'tr' ? 'Referans linki kopyalandı!' : 'Referral link copied!');
                            }}
                            className="bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                          >
                            {language === 'tr' ? 'Kopyala' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Live Preview (xl:col-span-1) */}
                  <div className="xl:col-span-1 flex flex-col gap-6">
                    {/* Görünüm Ayarları */}
                    <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.2)] space-y-4">
                      <div className="flex flex-col gap-3 pb-3 border-b border-white/[0.06]">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                          🎨 Görünüm
                        </h4>
                        <div className="flex items-center justify-between gap-3">
                          <label className="text-xs text-gray-400 font-semibold uppercase">Tema Modu:</label>
                          <select
                            value={widgetForm.theme || 'auto'}
                            onChange={(e) => {
                              const val = e.target.value as 'light' | 'dark' | 'auto';
                              updateFormField('theme', val);
                              updateFormField('auto_theme', val === 'auto');
                              if (val !== 'auto') {
                                setColorEditMode(val);
                              }
                            }}
                            className="px-3 py-1.5 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-xs text-gray-200 outline-none"
                          >
                            <option value="auto">🌈 Otomatik (Match Host)</option>
                            <option value="light">☀️ Açık Tema (Light)</option>
                            <option value="dark">🌙 Koyu Tema (Dark)</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <label className="text-xs text-gray-400 font-semibold uppercase">Tema Stili:</label>
                          <select
                            value={widgetForm.theme_style || 'classic'}
                            onChange={(e) => updateFormField('theme_style', e.target.value as 'classic' | 'modern')}
                            className="px-3 py-1.5 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-xs text-gray-200 outline-none"
                          >
                            <option value="classic">💬 Klasik Sohbet Botu</option>
                            <option value="modern">✨ Modern Glassmorphic</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs text-gray-400 font-semibold uppercase">{language === 'tr' ? 'Balon İkonu:' : 'Bubble Icon:'}</label>
                          <div className="grid grid-cols-5 gap-2">
                            {[
                              { key: 'chat', label: language === 'tr' ? 'Klasik' : 'Classic', icon: BUBBLE_ICONS.chat },
                              { key: 'dots', label: language === 'tr' ? 'Balon' : 'Dots', icon: BUBBLE_ICONS.dots },
                              { key: 'support', label: language === 'tr' ? 'Destek' : 'Support', icon: BUBBLE_ICONS.support },
                              { key: 'ai', label: language === 'tr' ? 'AI' : 'AI', icon: BUBBLE_ICONS.ai },
                              { key: 'ragleaf', label: language === 'tr' ? 'Ragleaf' : 'Ragleaf', icon: BUBBLE_ICONS.ragleaf },
                              { key: 'robot', label: language === 'tr' ? 'Robot' : 'Robot', icon: BUBBLE_ICONS.robot },
                              { key: 'brain', label: language === 'tr' ? 'Zihin' : 'Brain', icon: BUBBLE_ICONS.brain },
                              { key: 'smile', label: language === 'tr' ? 'Gülümseme' : 'Smile', icon: BUBBLE_ICONS.smile },
                              { key: 'globe', label: language === 'tr' ? 'Küre' : 'Globe', icon: BUBBLE_ICONS.globe },
                              { 
                                key: 'custom', 
                                label: language === 'tr' ? 'Özel' : 'Custom', 
                                icon: (widgetForm.custom_icon_svg && widgetForm.custom_icon_svg.includes('<svg'))
                                  ? widgetForm.custom_icon_svg.replace('<svg', '<svg class="w-6 h-6"')
                                  : '<svg viewBox="0 0 24 24" class="w-6 h-6"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>' 
                              }
                            ].map((opt) => {
                              const isSelected = (widgetForm.bubble_icon || 'chat') === opt.key;
                              return (
                                <button
                                  key={opt.key}
                                  type="button"
                                  onClick={() => updateFormField('bubble_icon', opt.key as any)}
                                  className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all duration-200 active:scale-[0.97] ${
                                    isSelected
                                      ? 'border-primary-500 bg-primary-500/10 text-primary-400 shadow-[0_0_12px_rgba(34,197,94,0.15)]'
                                      : 'border-white/[0.08] bg-dark-900/40 text-gray-400 hover:border-white/[0.2] hover:text-gray-200'
                                  }`}
                                >
                                  <div 
                                    className="w-5 h-5 flex items-center justify-center mb-1.5"
                                    dangerouslySetInnerHTML={{ __html: opt.icon }}
                                  />
                                  <span className="text-[10px] font-semibold tracking-wide truncate max-w-full">
                                    {opt.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {widgetForm.bubble_icon === 'custom' && (
                          <div className="space-y-2 mt-1">
                            <div className="flex justify-between items-center">
                              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{language === 'tr' ? 'Özel SVG Kodu:' : 'Custom SVG Code:'}</label>
                              <label className="cursor-pointer text-[10px] font-semibold text-primary-400 hover:text-primary-300 uppercase tracking-wider flex items-center gap-1">
                                📁 {language === 'tr' ? 'SVG Dosyası Yükle' : 'Upload SVG File'}
                                <input
                                  type="file"
                                  accept=".svg"
                                  onChange={handleSvgUpload}
                                  className="hidden"
                                />
                              </label>
                            </div>
                            <textarea
                              value={widgetForm.custom_icon_svg || ''}
                              onChange={(e) => updateFormField('custom_icon_svg', e.target.value)}
                              placeholder='<svg viewBox="0 0 24 24">...</svg>'
                              rows={3}
                              className="w-full bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none font-mono"
                            />
                            {widgetForm.custom_icon_svg && !widgetForm.custom_icon_svg.trim().startsWith('<svg') && (
                              <p className="text-[10px] text-red-400">
                                ⚠️ {language === 'tr' ? "SVG kodu '<svg ...' ile başlamalıdır." : "SVG code must start with '<svg ...'"}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {widgetForm.theme === 'auto' ? (
                        <div className="bg-primary-500/5 border border-primary-500/10 rounded-xl p-3 text-xs text-gray-400">
                          ℹ️ <strong>Otomatik (Match Host)</strong> aktif. Widget, yüklendiği sitenin temasını otomatik olarak yakalayacaktır. Aşağıdaki sekmelerden her iki tema için de manuel renkleri özelleştirebilirsiniz.
                        </div>
                      ) : (
                        <div className="bg-primary-500/5 border border-primary-500/10 rounded-xl p-3 text-xs text-gray-400">
                          ℹ️ Seçilen tema modu zorunlu kılınmıştır. Widget her zaman bu görünüm modunda yüklenecektir.
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 border-b border-white/[0.06] pb-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">{language === 'tr' ? 'Ana Renk' : 'Primary Color'}</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={widgetForm.primary_color}
                              onChange={(e) => updateFormField('primary_color', e.target.value)}
                              className="h-8 w-10 bg-transparent border-0 cursor-pointer rounded"
                            />
                            <input
                              type="text"
                              value={widgetForm.primary_color}
                              onChange={(e) => updateFormField('primary_color', e.target.value)}
                              className="w-full bg-dark-900 border border-white/[0.08] rounded px-2 py-1 text-xs text-gray-200 focus:outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">{language === 'tr' ? 'Yardımcı Renk' : 'Secondary Color'}</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={widgetForm.secondary_color || '#8b5cf6'}
                              onChange={(e) => updateFormField('secondary_color', e.target.value)}
                              className="h-8 w-10 bg-transparent border-0 cursor-pointer rounded"
                            />
                            <input
                              type="text"
                              value={widgetForm.secondary_color || '#8b5cf6'}
                              onChange={(e) => updateFormField('secondary_color', e.target.value)}
                              className="w-full bg-dark-900 border border-white/[0.08] rounded px-2 py-1 text-xs text-gray-200 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {widgetForm.theme === 'auto' && (
                        <div className="flex gap-2 p-1 bg-dark-900 border border-white/[0.08] rounded-xl w-fit">
                          <button
                            type="button"
                            onClick={() => setColorEditMode('light')}
                            className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                              colorEditMode === 'light'
                                ? 'bg-primary-600 text-white shadow-md'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            ☀️ Açık
                          </button>
                          <button
                            type="button"
                            onClick={() => setColorEditMode('dark')}
                            className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                              colorEditMode === 'dark'
                                ? 'bg-primary-600 text-white shadow-md'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            🌙 Koyu
                          </button>
                        </div>
                      )}

                      {(() => {
                        const activeEditMode = widgetForm.theme === 'auto' ? colorEditMode : widgetForm.theme;
                        return (
                          activeEditMode === 'light' ? (
                            <div className="grid grid-cols-2 gap-4">
                              <div className={widgetForm.auto_theme ? 'opacity-40 pointer-events-none' : ''}>
                                <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Yazı Rengi</label>
                                <div className="flex gap-2">
                                  <input
                                    type="color"
                                    value={widgetForm.text_color || '#1F2937'}
                                    onChange={(e) => updateFormField('text_color', e.target.value)}
                                    className="h-8 w-10 bg-transparent border-0 cursor-pointer rounded"
                                  />
                                  <input
                                    type="text"
                                    value={widgetForm.text_color || '#1F2937'}
                                    onChange={(e) => updateFormField('text_color', e.target.value)}
                                    className="w-full bg-dark-900 border border-white/[0.08] rounded px-1.5 py-0.5 text-[10px] text-gray-200 focus:outline-none"
                                  />
                                </div>
                              </div>
                              <div className={widgetForm.auto_theme ? 'opacity-40 pointer-events-none' : ''}>
                                <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Pencere Arkaplanı</label>
                                <div className="flex gap-2">
                                  <input
                                    type="color"
                                    value={widgetForm.bg_color || '#FFFFFF'}
                                    onChange={(e) => updateFormField('bg_color', e.target.value)}
                                    className="h-8 w-10 bg-transparent border-0 cursor-pointer rounded"
                                  />
                                  <input
                                    type="text"
                                    value={widgetForm.bg_color || '#FFFFFF'}
                                    onChange={(e) => updateFormField('bg_color', e.target.value)}
                                    className="w-full bg-dark-900 border border-white/[0.08] rounded px-1.5 py-0.5 text-[10px] text-gray-200 focus:outline-none"
                                  />
                                </div>
                              </div>
                              <div className={widgetForm.auto_theme ? 'opacity-40 pointer-events-none' : ''}>
                                <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Kenarlık</label>
                                <div className="flex gap-2">
                                  <input
                                    type="color"
                                    value={widgetForm.border_color || '#E5E7EB'}
                                    onChange={(e) => updateFormField('border_color', e.target.value)}
                                    className="h-8 w-10 bg-transparent border-0 cursor-pointer rounded"
                                  />
                                  <input
                                    type="text"
                                    value={widgetForm.border_color || '#E5E7EB'}
                                    onChange={(e) => updateFormField('border_color', e.target.value)}
                                    className="w-full bg-dark-900 border border-white/[0.08] rounded px-1.5 py-0.5 text-[10px] text-gray-200 focus:outline-none"
                                  />
                                </div>
                              </div>
                              <div className={widgetForm.auto_theme ? 'opacity-40 pointer-events-none' : ''}>
                                <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Giriş Arkaplanı</label>
                                <div className="flex gap-2">
                                  <input
                                    type="color"
                                    value={widgetForm.input_bg_color || '#FFFFFF'}
                                    onChange={(e) => updateFormField('input_bg_color', e.target.value)}
                                    className="h-8 w-10 bg-transparent border-0 cursor-pointer rounded"
                                  />
                                  <input
                                    type="text"
                                    value={widgetForm.input_bg_color || '#FFFFFF'}
                                    onChange={(e) => updateFormField('input_bg_color', e.target.value)}
                                    className="w-full bg-dark-900 border border-white/[0.08] rounded px-1.5 py-0.5 text-[10px] text-gray-200 focus:outline-none"
                                  />
                                </div>
                              </div>
                              <div className={widgetForm.auto_theme ? 'opacity-40 pointer-events-none' : ''}>
                                <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Giriş Yazı</label>
                                <div className="flex gap-2">
                                  <input
                                    type="color"
                                    value={widgetForm.input_text_color || '#1F2937'}
                                    onChange={(e) => updateFormField('input_text_color', e.target.value)}
                                    className="h-8 w-10 bg-transparent border-0 cursor-pointer rounded"
                                  />
                                  <input
                                    type="text"
                                    value={widgetForm.input_text_color || '#1F2937'}
                                    onChange={(e) => updateFormField('input_text_color', e.target.value)}
                                    className="w-full bg-dark-900 border border-white/[0.08] rounded px-1.5 py-0.5 text-[10px] text-gray-200 focus:outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-4">
                              <div className={widgetForm.auto_theme ? 'opacity-40 pointer-events-none' : ''}>
                                <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Yazı Rengi (Koyu)</label>
                                <div className="flex gap-2">
                                  <input
                                    type="color"
                                    value={widgetForm.text_color_dark || '#F3F4F6'}
                                    onChange={(e) => updateFormField('text_color_dark', e.target.value)}
                                    className="h-8 w-10 bg-transparent border-0 cursor-pointer rounded"
                                  />
                                  <input
                                    type="text"
                                    value={widgetForm.text_color_dark || '#F3F4F6'}
                                    onChange={(e) => updateFormField('text_color_dark', e.target.value)}
                                    className="w-full bg-dark-900 border border-white/[0.08] rounded px-1.5 py-0.5 text-[10px] text-gray-200 focus:outline-none"
                                  />
                                </div>
                              </div>
                              <div className={widgetForm.auto_theme ? 'opacity-40 pointer-events-none' : ''}>
                                <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Pencere Arkaplanı (Koyu)</label>
                                <div className="flex gap-2">
                                  <input
                                    type="color"
                                    value={widgetForm.bg_color_dark || '#090D16'}
                                    onChange={(e) => updateFormField('bg_color_dark', e.target.value)}
                                    className="h-8 w-10 bg-transparent border-0 cursor-pointer rounded"
                                  />
                                  <input
                                    type="text"
                                    value={widgetForm.bg_color_dark || '#090D16'}
                                    onChange={(e) => updateFormField('bg_color_dark', e.target.value)}
                                    className="w-full bg-dark-900 border border-white/[0.08] rounded px-1.5 py-0.5 text-[10px] text-gray-200 focus:outline-none"
                                  />
                                </div>
                              </div>
                              <div className={widgetForm.auto_theme ? 'opacity-40 pointer-events-none' : ''}>
                                <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Kenarlık (Koyu)</label>
                                <div className="flex gap-2">
                                  <input
                                    type="color"
                                    value={widgetForm.border_color_dark || '#374151'}
                                    onChange={(e) => updateFormField('border_color_dark', e.target.value)}
                                    className="h-8 w-10 bg-transparent border-0 cursor-pointer rounded"
                                  />
                                  <input
                                    type="text"
                                    value={widgetForm.border_color_dark || '#374151'}
                                    onChange={(e) => updateFormField('border_color_dark', e.target.value)}
                                    className="w-full bg-dark-900 border border-white/[0.08] rounded px-1.5 py-0.5 text-[10px] text-gray-200 focus:outline-none"
                                  />
                                </div>
                              </div>
                              <div className={widgetForm.auto_theme ? 'opacity-40 pointer-events-none' : ''}>
                                <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Giriş Arkaplanı (Koyu)</label>
                                <div className="flex gap-2">
                                  <input
                                    type="color"
                                    value={widgetForm.input_bg_color_dark || '#111827'}
                                    onChange={(e) => updateFormField('input_bg_color_dark', e.target.value)}
                                    className="h-8 w-10 bg-transparent border-0 cursor-pointer rounded"
                                  />
                                  <input
                                    type="text"
                                    value={widgetForm.input_bg_color_dark || '#111827'}
                                    onChange={(e) => updateFormField('input_bg_color_dark', e.target.value)}
                                    className="w-full bg-dark-900 border border-white/[0.08] rounded px-1.5 py-0.5 text-[10px] text-gray-200 focus:outline-none"
                                  />
                                </div>
                              </div>
                              <div className={widgetForm.auto_theme ? 'opacity-40 pointer-events-none' : ''}>
                                <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wider">Giriş Yazı (Koyu)</label>
                                <div className="flex gap-2">
                                  <input
                                    type="color"
                                    value={widgetForm.input_text_color_dark || '#F3F4F6'}
                                    onChange={(e) => updateFormField('input_text_color_dark', e.target.value)}
                                    className="h-8 w-10 bg-transparent border-0 cursor-pointer rounded"
                                  />
                                  <input
                                    type="text"
                                    value={widgetForm.input_text_color_dark || '#F3F4F6'}
                                    onChange={(e) => updateFormField('input_text_color_dark', e.target.value)}
                                    className="w-full bg-dark-900 border border-white/[0.08] rounded px-1.5 py-0.5 text-[10px] text-gray-200 focus:outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                          )
                        );
                      })()}
                    </div>

                    {/* Right Side: Live Preview (xl:col-span-1) */}
                    <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.2)] flex flex-col h-full">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        👀 {language === 'tr' ? 'Canlı Önizleme' : 'Live Preview'}
                      </h3>
                    </div>
                    <div 
                      className="flex-1 bg-dark-950 border border-white/[0.08] rounded-xl relative overflow-hidden flex flex-col justify-between p-4 min-h-[360px]"
                      style={{
                        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(34, 197, 94, 0.08) 0%, transparent 75%), radial-gradient(circle at 100% 0%, rgba(79, 70, 229, 0.08) 0%, transparent 50%)'
                      }}
                    >
                      
                      {(() => {
                        const bgVal = widgetForm.auto_theme ? undefined : (previewTheme === 'dark' ? widgetForm.bg_color_dark || '#090D16' : widgetForm.bg_color || '#FFFFFF');
                        const textVal = widgetForm.auto_theme ? undefined : (previewTheme === 'dark' ? widgetForm.text_color_dark || '#F3F4F6' : widgetForm.text_color || '#1F2937');
                        const borderVal = widgetForm.auto_theme ? undefined : (previewTheme === 'dark' ? widgetForm.border_color_dark || '#374151' : widgetForm.border_color || '#E5E7EB');
                        const inputBgVal = widgetForm.auto_theme ? undefined : (previewTheme === 'dark' ? widgetForm.input_bg_color_dark || '#111827' : widgetForm.input_bg_color || '#FFFFFF');
                        const inputTextVal = widgetForm.auto_theme ? undefined : (previewTheme === 'dark' ? widgetForm.input_text_color_dark || '#F3F4F6' : widgetForm.input_text_color || '#1F2937');

                        const isModern = widgetForm.theme_style === 'modern';
                        const mockupBg = isModern 
                          ? (previewTheme === 'dark' ? 'rgba(9, 13, 22, 0.75)' : 'rgba(255, 255, 255, 0.7)')
                          : bgVal;
                        const mockupBgImage = isModern 
                          ? (previewTheme === 'dark' 
                            ? `radial-gradient(at 0% 0%, color-mix(in srgb, ${widgetForm.primary_color || '#3b82f6'} 15%, transparent) 0px, transparent 50%), radial-gradient(at 100% 100%, color-mix(in srgb, ${widgetForm.secondary_color || '#8b5cf6'} 15%, transparent) 0px, transparent 50%), linear-gradient(135deg, rgba(9, 13, 22, 0.85), rgba(17, 24, 39, 0.9))` 
                            : `radial-gradient(at 0% 0%, color-mix(in srgb, ${widgetForm.primary_color || '#3b82f6'} 8%, transparent) 0px, transparent 50%), radial-gradient(at 100% 100%, color-mix(in srgb, ${widgetForm.secondary_color || '#8b5cf6'} 8%, transparent) 0px, transparent 50%), linear-gradient(135deg, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.75))`)
                          : undefined;
                        const mockupBlur = isModern ? 'blur(20px)' : undefined;
                        const mockupHeaderBg = isModern ? 'transparent' : widgetForm.primary_color;
                        const mockupHeaderTextColor = isModern ? textVal : '#FFFFFF';
                        const mockupHeaderBorder = isModern ? `1px solid ${borderVal}` : undefined;
                        const mockupAssistantBg = isModern
                          ? (previewTheme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.5)')
                          : bgVal;
                        const mockupAssistantBorder = isModern
                          ? (previewTheme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.08)')
                          : borderVal;
                        const mockupInputBg = isModern ? 'transparent' : inputBgVal;
                        const mockupInputAreaBg = isModern ? 'transparent' : bgVal;

                        const initials = (widgetForm.name || selectedAgent?.name || 'RL').slice(0, 2).toUpperCase();

                        return (
                          <>
                            {widgetForm.layout_mode === 'floating' && (
                              <>
                                {/* Chat Window Mockup */}
                                <div 
                                  className={`border overflow-hidden flex flex-col flex-1 max-w-[280px] w-full shadow-2xl transition-all relative ${((widgetForm.position as string) === 'bottom-right' || (widgetForm.position as string) === 'right' || !widgetForm.position) ? 'self-end' : 'self-start'}`} 
                                  style={{ 
                                    borderRadius: `${widgetForm.border_radius}px`,
                                    backgroundColor: mockupBgImage ? undefined : mockupBg,
                                    backgroundImage: mockupBgImage,
                                    backdropFilter: mockupBlur,
                                    WebkitBackdropFilter: mockupBlur,
                                    borderColor: borderVal,
                                    color: textVal
                                  }}
                                >
                                  {isModern && (
                                    <div 
                                      className="h-[3px] w-full shrink-0" 
                                      style={{
                                        background: `linear-gradient(90deg, ${widgetForm.primary_color}, ${widgetForm.secondary_color || '#8b5cf6'})`
                                      }}
                                    />
                                  )}
                                  <div className="px-3 py-2 flex items-center justify-between text-[10px] font-bold" style={{ backgroundColor: mockupHeaderBg, color: mockupHeaderTextColor, borderBottom: mockupHeaderBorder }}>
                                    <span>{widgetForm.name || selectedAgent?.name}</span>
                                    <span>✕</span>
                                  </div>
                                  <div className="p-3 flex-1 space-y-2 text-[9px] min-h-[140px] flex flex-col justify-end" style={{ backgroundColor: isModern ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                                    {isModern ? (
                                      <div className="flex gap-2 items-start max-w-[90%] self-start">
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0 shadow-sm" style={{ backgroundColor: widgetForm.primary_color }}>
                                          {initials}
                                        </div>
                                        <div 
                                          className="p-2 rounded-xl border transition-all"
                                          style={{ 
                                            backgroundColor: mockupAssistantBg,
                                            color: textVal,
                                            borderColor: mockupAssistantBorder
                                          }}
                                        >
                                          {widgetForm.welcome_message || 'Merhaba! Size nasıl yardımcı olabilirim?'}
                                        </div>
                                      </div>
                                    ) : (
                                      <div 
                                        className="p-2 rounded-lg max-w-[90%] self-start border transition-all"
                                        style={{ 
                                          backgroundColor: mockupAssistantBg,
                                          color: textVal,
                                          borderColor: mockupAssistantBorder
                                        }}
                                      >
                                        {widgetForm.welcome_message || 'Merhaba! Size nasıl yardımcı olabilirim?'}
                                      </div>
                                    )}
                                  </div>
                                  <div 
                                    className="p-2 border-t flex gap-1 transition-all"
                                    style={{ 
                                      backgroundColor: mockupInputAreaBg,
                                      borderTopColor: borderVal
                                    }}
                                  >
                                    <div 
                                      className="flex-1 border rounded px-2 py-1 text-[8px] transition-all"
                                      style={{
                                        backgroundColor: mockupInputBg,
                                        color: inputTextVal,
                                        borderColor: borderVal
                                      }}
                                    >
                                      Mesajınızı yazın...
                                    </div>
                                    <div className="w-5 h-5 rounded flex items-center justify-center text-[8px] text-white" style={{ backgroundColor: widgetForm.primary_color }}>➤</div>
                                  </div>
                                  {widgetForm.show_branding !== false && (
                                    <div className="py-1 text-[7px] text-gray-500 text-center border-t transition-all" style={{ backgroundColor: mockupInputAreaBg, borderTopColor: borderVal }}>
                                      {language === 'tr' ? 'Ragleaf AIChat' : 'Powered by Ragleaf'}
                                    </div>
                                  )}
                                </div>
                                
                                {/* Floating Bubble Mockup */}
                                <div 
                                  className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg border border-white/10 mt-4 animate-bounce text-white/90 ${((widgetForm.position as string) === 'bottom-right' || (widgetForm.position as string) === 'right' || !widgetForm.position) ? 'self-end' : 'self-start'}`}
                                  style={{ backgroundColor: widgetForm.primary_color }}
                                  dangerouslySetInnerHTML={{ __html: getMockupBubbleIcon() }}
                                />
                              </>
                            )}

                            {widgetForm.layout_mode === 'split' && (
                              <div 
                                className="flex-1 flex border rounded-xl overflow-hidden transition-all bg-dark-800"
                                style={{
                                  borderColor: borderVal
                                }}
                              >
                                <div className="flex-1 p-2.5 space-y-1.5 opacity-25">
                                  <div className="h-1 bg-gray-400 rounded w-full"></div>
                                  <div className="h-1 bg-gray-400 rounded w-5/6"></div>
                                  <div className="h-1 bg-gray-400 rounded w-4/6"></div>
                                </div>
                                <div 
                                  className="w-[120px] border-l flex flex-col justify-between transition-all relative"
                                  style={{
                                    borderLeftColor: borderVal,
                                    backgroundColor: mockupBgImage ? undefined : mockupBg,
                                    backgroundImage: mockupBgImage,
                                    backdropFilter: mockupBlur,
                                    WebkitBackdropFilter: mockupBlur,
                                    color: textVal
                                  }}
                                >
                                  {isModern && (
                                    <div 
                                      className="h-[3px] w-full shrink-0" 
                                      style={{
                                        background: `linear-gradient(90deg, ${widgetForm.primary_color}, ${widgetForm.secondary_color || '#8b5cf6'})`
                                      }}
                                    />
                                  )}
                                  <div className="px-2 py-1.5 text-[8px] font-bold" style={{ backgroundColor: mockupHeaderBg, color: mockupHeaderTextColor, borderBottom: mockupHeaderBorder }}>
                                    {widgetForm.name || selectedAgent?.name}
                                  </div>
                                  <div className="p-1.5 flex-1 flex flex-col justify-end text-[7px] space-y-1" style={{ backgroundColor: isModern ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                                    {isModern ? (
                                      <div className="flex gap-1.5 items-start max-w-[90%] self-start">
                                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0 shadow-sm" style={{ backgroundColor: widgetForm.primary_color }}>
                                          {initials}
                                        </div>
                                        <div 
                                          className="p-1.5 rounded-xl border transition-all"
                                          style={{ 
                                            backgroundColor: mockupAssistantBg,
                                            borderColor: mockupAssistantBorder,
                                            color: textVal
                                          }}
                                        >
                                          {widgetForm.welcome_message || 'Merhaba!'}
                                        </div>
                                      </div>
                                    ) : (
                                      <div 
                                        className="p-1.5 rounded leading-snug border transition-all"
                                        style={{
                                          backgroundColor: mockupAssistantBg,
                                          borderColor: mockupAssistantBorder,
                                          color: textVal
                                        }}
                                      >
                                        {widgetForm.welcome_message || 'Merhaba!'}
                                      </div>
                                    )}
                                  </div>
                                  <div 
                                    className="p-1 border-t flex gap-1 transition-all"
                                    style={{
                                      backgroundColor: mockupInputAreaBg,
                                      borderTopColor: borderVal
                                    }}
                                  >
                                    <div 
                                      className="flex-1 border rounded px-1 py-0.5 text-[6px] transition-all"
                                      style={{
                                        backgroundColor: mockupInputBg,
                                        color: inputTextVal,
                                        borderColor: borderVal
                                      }}
                                    >
                                      Yazın...
                                    </div>
                                    <div className="w-3.5 h-3.5 rounded flex items-center justify-center text-[6px] text-white" style={{ backgroundColor: widgetForm.primary_color }}>➤</div>
                                  </div>
                                  {widgetForm.show_branding !== false && (
                                    <div className="py-0.5 text-[6px] text-gray-500 text-center border-t transition-all" style={{ backgroundColor: mockupInputAreaBg, borderTopColor: borderVal }}>
                                      {language === 'tr' ? 'Ragleaf AIChat' : 'Powered by Ragleaf'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {widgetForm.layout_mode === 'fullscreen' && (
                              <div 
                                className="flex-1 border rounded-xl overflow-hidden flex flex-col transition-all relative"
                                style={{
                                  backgroundColor: mockupBgImage ? undefined : mockupBg,
                                  backgroundImage: mockupBgImage,
                                  backdropFilter: mockupBlur,
                                  WebkitBackdropFilter: mockupBlur,
                                  borderColor: borderVal,
                                  color: textVal
                                }}
                              >
                                {isModern && (
                                    <div 
                                      className="h-[3px] w-full shrink-0" 
                                      style={{
                                        background: `linear-gradient(90deg, ${widgetForm.primary_color}, ${widgetForm.secondary_color || '#8b5cf6'})`
                                      }}
                                    />
                                  )}
                                <div className="px-3 py-2 flex items-center justify-between text-[10px] font-bold" style={{ backgroundColor: mockupHeaderBg, color: mockupHeaderTextColor, borderBottom: mockupHeaderBorder }}>
                                  <span>{widgetForm.name || selectedAgent?.name}</span>
                                </div>
                                <div className="p-3 flex-1 flex flex-col justify-end text-[9px] min-h-[160px]" style={{ backgroundColor: isModern ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                                  {isModern ? (
                                    <div className="flex gap-2 items-start max-w-[80%] self-start">
                                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0 shadow-sm" style={{ backgroundColor: widgetForm.primary_color }}>
                                        {initials}
                                      </div>
                                      <div 
                                        className="p-2 rounded-xl border transition-all"
                                        style={{ 
                                          backgroundColor: mockupAssistantBg,
                                          borderColor: mockupAssistantBorder,
                                          color: textVal
                                        }}
                                      >
                                        {widgetForm.welcome_message || 'Merhaba!'}
                                      </div>
                                    </div>
                                  ) : (
                                    <div 
                                      className="p-2 rounded-lg max-w-[80%] self-start border transition-all"
                                      style={{
                                        backgroundColor: mockupAssistantBg,
                                        borderColor: mockupAssistantBorder,
                                        color: textVal
                                      }}
                                    >
                                      {widgetForm.welcome_message || 'Merhaba!'}
                                    </div>
                                  )}
                                </div>
                                <div 
                                  className="p-2 border-t flex gap-1 transition-all"
                                  style={{
                                    backgroundColor: mockupInputAreaBg,
                                    borderTopColor: borderVal
                                  }}
                                >
                                  <div 
                                    className="flex-1 border rounded px-2 py-1 text-[8px] transition-all"
                                    style={{
                                      backgroundColor: mockupInputBg,
                                      color: inputTextVal,
                                      borderColor: borderVal
                                    }}
                                  >
                                    Mesajınızı yazın...
                                  </div>
                                  <div className="w-5 h-5 rounded flex items-center justify-center text-[8px] text-white" style={{ backgroundColor: widgetForm.primary_color }}>➤</div>
                                </div>
                                {(isTrial || widgetForm.show_branding !== false) && (
                                  <div className="py-1 text-[7px] text-gray-500 text-center border-t transition-all" style={{ backgroundColor: mockupInputAreaBg, borderTopColor: borderVal }}>
                                    Powered by <span className="font-semibold text-gray-400">Ragleaf</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

              </div>

                {codeLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
                  </div>
                ) : embedCode ? (
                  <div className="space-y-4">
                    {/* Simplified Integration Option Selector */}
                    <div className="flex flex-wrap gap-2 bg-dark-800/60 p-1.5 rounded-xl border border-white/[0.06] w-fit">
                      {[
                        { id: 'html' as const, label: 'HTML / JS' },
                        { id: 'react' as const, label: 'React' },
                        { id: 'nextjs' as const, label: 'Next.js' },
                        { id: 'wordpress' as const, label: 'WordPress' },
                      ].map((plat) => (
                        <button
                          key={plat.id}
                          onClick={() => setWidgetPlatform(plat.id)}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                            widgetPlatform === plat.id
                              ? 'bg-primary-600 text-white shadow-md'
                              : 'text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          {plat.label}
                        </button>
                      ))}
                    </div>

                    {/* Code Block */}
                    <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
                      <div className="flex items-center justify-between px-5 py-3 bg-dark-700/50 border-b border-white/[0.06]">
                        <span className="text-sm font-medium text-gray-300">
                          Widget Script ({widgetPlatform.toUpperCase()})
                        </span>
                        <button
                          onClick={() => copyToClipboard(
                            getCustomPlatformWidgetCode(widgetForm, widgetPlatform)
                          )}
                          className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700 transition"
                        >
                          {copied ? t('widget.copied') : t('widget.btn_copy')}
                        </button>
                      </div>
                      <pre className="p-5 text-xs text-gray-200 bg-dark-900 text-green-400 overflow-x-auto font-mono leading-relaxed max-h-[320px]">
                        {getCustomPlatformWidgetCode(widgetForm, widgetPlatform)}
                      </pre>
                      <div className="px-5 py-3 bg-primary-500/10 border-t border-primary-500/20">
                        <p className="text-sm text-primary-400">
                          💡 {widgetPlatform === 'html' && 'Bu kodu web sitenizin <body> tag\'ının sonuna (kapanış etiketinden hemen önce) ekleyin.'}
                          {widgetPlatform === 'react' && 'React uygulamanızda bu bileşeni (Component) en üst seviye layout veya ana sayfa bileşenine dahil edin.'}
                          {widgetPlatform === 'nextjs' && 'Next.js uygulamanızın RootLayout (layout.js/tsx) dosyasına ekleyin. next/script otomatik olarak optimize eder.'}
                          {widgetPlatform === 'wordpress' && 'WordPress sitenizin aktif temasındaki functions.php dosyasının en sonuna bu PHP kodunu yapıştırın.'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="bg-dark-800/60 rounded-xl border border-white/[0.06] p-12 text-center shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
                <p className="text-lg text-gray-400">
                  {language === 'tr' 
                    ? 'Lütfen sol taraftan düzenlemek istediğiniz widget\'ı seçin veya yeni bir tane oluşturun.' 
                    : 'Please select a widget from the left or create a new one.'}
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* New Widget Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/60">
          <div className="bg-dark-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-white/[0.06]">
            <div className="px-6 py-4 border-b border-white/[0.06] bg-dark-700/50 flex items-center justify-between">
              <h3 className="font-bold text-gray-100 text-base">
                ✨ {language === 'tr' ? 'Yeni Widget Oluştur' : 'Create New Widget'}
              </h3>
              <button onClick={() => setShowNewModal(false)} className="text-gray-400 hover:text-gray-200">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                  {language === 'tr' ? 'Widget Adı' : 'Widget Name'}
                </label>
                <input
                  type="text"
                  value={newWidgetName}
                  onChange={(e) => setNewWidgetName(e.target.value)}
                  placeholder="e.g. Web Sitem, Destek Botu"
                  className="w-full px-3.5 py-2 bg-dark-900 border border-white/[0.08] focus:border-primary-500 rounded-lg text-sm text-gray-200 outline-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-dark-700/50 border-t border-white/[0.06] flex justify-end gap-3">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 bg-dark-600 hover:bg-dark-500 text-gray-300 rounded-xl text-xs font-semibold transition"
              >
                Vazgeç
              </button>
              <button
                onClick={handleCreateWidget}
                disabled={!newWidgetName.trim()}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
              >
                Oluştur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
