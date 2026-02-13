import { useMemo, useState, useEffect } from "react";
import {
  Sparkles, Play, Mic, MapPin, User, BarChart3, List,
  CheckCheck, File,
} from "lucide-react";

export interface WhatsAppPreviewProps {
  messageType: string;
  textContent?: string;
  mediaUrl?: string;
  caption?: string;
  locName?: string;
  locAddress?: string;
  locLat?: string;
  locLng?: string;
  contactName?: string;
  contactPhone?: string;
  pollName?: string;
  pollOptions?: string[];
  listTitle?: string;
  listDescription?: string;
  listButtonText?: string;
  listFooter?: string;
  listSections?: { title: string; rows: { title: string; description: string }[] }[];
  aiPrompt?: string;
}

function TimeStamp() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1.5 align-bottom whitespace-nowrap" style={{ float: 'right', marginTop: '3px' }}>
      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', lineHeight: 1 }}>12:00</span>
      <CheckCheck style={{ width: '14px', height: '14px', color: '#53bdeb' }} />
    </span>
  );
}

function Bubble({ children, noBubble = false }: { children: React.ReactNode; noBubble?: boolean }) {
  if (noBubble) {
    return <div className="flex justify-end px-3 py-0.5">{children}</div>;
  }
  return (
    <div className="flex justify-end px-[18px] py-[1px]">
      <div
        style={{
          backgroundColor: '#005c4b',
          borderRadius: '7.5px',
          borderTopRightRadius: 0,
          maxWidth: '95%',
          padding: '6px 7px 8px 9px',
          position: 'relative',
          boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)',
        }}
      >
        {/* Tail */}
        <svg
          viewBox="0 0 8 13"
          height="13"
          width="8"
          style={{ position: 'absolute', top: 0, right: '-8px' }}
        >
          <path opacity=".13" d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" />
          <path fill="#005c4b" d="M5.188 0H0v11.193l6.467-8.625C7.526 1.156 6.958 0 5.188 0z" />
        </svg>
        {children}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: '180px' }}>
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', textAlign: 'center' }}>
        Componha uma mensagem<br />para ver o preview
      </p>
    </div>
  );
}

// Stable waveform heights to avoid re-render jitter
const WAVEFORM_HEIGHTS = Array.from({ length: 30 }, (_, i) =>
  Math.sin(i * 0.6) * 10 + Math.cos(i * 1.2) * 5 + 8
);

// Format WhatsApp text: *bold*, _italic_, ~strikethrough~, ```monospace```
function formatWhatsAppText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Regex: ```code```, *bold*, _italic_, ~strike~
  const regex = /```([\s\S]*?)```|\*([^*]+)\*|_([^_]+)_|~([^~]+)~/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      parts.push(<code key={key++} style={{ fontFamily: 'monospace', fontSize: '13px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', padding: '1px 3px' }}>{match[1]}</code>);
    } else if (match[2] !== undefined) {
      parts.push(<strong key={key++} style={{ fontWeight: 700 }}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      parts.push(<em key={key++}>{match[3]}</em>);
    } else if (match[4] !== undefined) {
      parts.push(<del key={key++}>{match[4]}</del>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

// Detect URL in text
const URL_REGEX = /https?:\/\/[^\s]+/i;

function LinkPreviewCard({ url }: { url: string }) {
  const [ogData, setOgData] = useState<{ image?: string; title?: string; domain?: string } | null>(null);

  const domain = useMemo(() => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
  }, [url]);

  useEffect(() => {
    setOgData(null);
    const controller = new AbortController();
    fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`, { signal: controller.signal })
      .then(r => r.json())
      .then(res => {
        if (res.status === 'success' && res.data) {
          setOgData({
            image: res.data.image?.url || res.data.logo?.url,
            title: res.data.title,
            domain: res.data.publisher || domain,
          });
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [url, domain]);

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

  return (
    <div style={{ borderRadius: '6px', overflow: 'hidden', marginBottom: '4px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ background: '#0d1b2a', position: 'relative', overflow: 'hidden' }}>
        {ogData?.image ? (
          <img
            src={ogData.image}
            alt=""
            style={{ width: '100%', height: 'auto', display: 'block' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div style={{ width: '100%', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={faviconUrl} alt="" style={{ width: '32px', height: '32px', opacity: 0.4 }} />
          </div>
        )}
      </div>
      <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <img
          src={faviconUrl}
          alt=""
          style={{ width: '16px', height: '16px', borderRadius: '2px', flexShrink: 0 }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'lowercase', lineHeight: 1.2 }}>{domain}</p>
          <p style={{ fontSize: '12.5px', color: '#e9edef', fontWeight: 500, lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ogData?.title || domain.charAt(0).toUpperCase() + domain.slice(1)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function WhatsAppPreview(props: WhatsAppPreviewProps) {
  const {
    messageType, textContent, mediaUrl, caption,
    locName, locAddress, locLat, locLng,
    contactName, contactPhone, pollName, pollOptions,
    listTitle, listDescription, listButtonText, listFooter,
    aiPrompt,
  } = props;

  const detectedUrl = useMemo(() => {
    if (messageType === 'text' && textContent) {
      const match = textContent.match(URL_REGEX);
      return match ? match[0] : null;
    }
    return null;
  }, [messageType, textContent]);

  const hasContent = () => {
    switch (messageType) {
      case "text": return !!textContent?.trim();
      case "ai": return !!aiPrompt?.trim();
      case "image": case "video": case "document": case "audio": case "sticker": return !!mediaUrl;
      case "location": return !!locLat && !!locLng;
      case "contact": return !!contactName;
      case "poll": return !!pollName;
      case "list": return !!listTitle;
      default: return false;
    }
  };

  const renderContent = () => {
    switch (messageType) {
      case "text":
        return (
          <Bubble>
            {detectedUrl && <LinkPreviewCard url={detectedUrl} />}
            <span style={{ fontSize: '14.2px', color: '#e9edef', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '8px' }}>
              {formatWhatsAppText(textContent || '')}
            </span>
            <TimeStamp />
          </Bubble>
        );

      case "ai":
        return (
          <Bubble>
            <div className="flex items-center gap-1.5" style={{ marginBottom: '4px' }}>
              <Sparkles style={{ width: '14px', height: '14px', color: '#53bdeb', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', color: '#e9edef', fontStyle: 'italic', opacity: 0.75 }}>
                Texto gerado pela I.A.
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '4px', marginTop: '2px' }}>
              Prompt: {aiPrompt}
            </p>
            <TimeStamp />
          </Bubble>
        );

      case "image":
        return (
          <Bubble>
            <div style={{ borderRadius: '6px', overflow: 'hidden', marginBottom: caption ? '4px' : '0' }}>
              <img src={mediaUrl} alt="" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', display: 'block' }} />
            </div>
            {caption && (
              <span style={{ fontSize: '14.2px', color: '#e9edef', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '8px' }}>
                {formatWhatsAppText(caption)}
              </span>
            )}
            <TimeStamp />
          </Bubble>
        );

      case "video":
        return (
          <Bubble>
            <div style={{ borderRadius: '6px', overflow: 'hidden', marginBottom: caption ? '4px' : '0', height: '140px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.5))' }} />
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                <Play style={{ width: '20px', height: '20px', color: 'white', fill: 'white', marginLeft: '2px' }} />
              </div>
            </div>
             {caption && (
              <span style={{ fontSize: '14.2px', color: '#e9edef', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '8px' }}>
                {formatWhatsAppText(caption)}
              </span>
            )}
            <TimeStamp />
          </Bubble>
        );

      case "document":
        return (
          <Bubble>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px', marginBottom: caption ? '4px' : '0' }}>
              <File style={{ width: '30px', height: '30px', color: '#53bdeb', flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: '13px', color: '#e9edef', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {mediaUrl?.split("/").pop() || "documento"}
                </p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Documento</p>
              </div>
            </div>
            {caption && (
              <span style={{ fontSize: '14.2px', color: '#e9edef', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '8px' }}>
                {formatWhatsAppText(caption)}
              </span>
            )}
            <TimeStamp />
          </Bubble>
        );

      case "audio":
        return (
          <Bubble>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '2px', paddingBottom: '2px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Mic style={{ width: '16px', height: '16px', color: 'white' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'end', gap: '1.5px', height: '20px' }}>
                  {WAVEFORM_HEIGHTS.map((h, i) => (
                    <div key={i} style={{ width: '2.5px', borderRadius: '9px', background: 'rgba(255,255,255,0.4)', height: `${h}px` }} />
                  ))}
                </div>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>0:12</p>
              </div>
            </div>
            <TimeStamp />
          </Bubble>
        );

      case "sticker":
        return (
          <Bubble noBubble>
            <div style={{ maxWidth: '140px' }}>
              <img src={mediaUrl} alt="Sticker" style={{ width: '100%', height: 'auto' }} />
            </div>
          </Bubble>
        );

      case "location":
        return (
          <Bubble>
            <div style={{ borderRadius: '6px', overflow: 'hidden', marginBottom: '4px', height: '100px', background: '#1a3a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, opacity: 0.2, backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(255,255,255,0.06) 20px, rgba(255,255,255,0.06) 21px), repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(255,255,255,0.06) 20px, rgba(255,255,255,0.06) 21px)' }} />
              <MapPin style={{ width: '28px', height: '28px', color: '#ff5252', zIndex: 1 }} />
            </div>
            {locName && <p style={{ fontSize: '13px', color: '#e9edef', fontWeight: 500 }}>{locName}</p>}
            {locAddress && <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{locAddress}</p>}
            {!locName && !locAddress && <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{locLat}, {locLng}</p>}
            <TimeStamp />
          </Bubble>
        );

      case "contact":
        return (
          <Bubble>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User style={{ width: '20px', height: '20px', color: '#aebac1' }} />
              </div>
              <div>
                <p style={{ fontSize: '13.5px', color: '#e9edef', fontWeight: 500 }}>{contactName}</p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{contactPhone}</p>
              </div>
            </div>
            <div style={{ paddingTop: '6px', textAlign: 'center' }}>
              <span style={{ fontSize: '13px', color: '#53bdeb', fontWeight: 500 }}>Enviar mensagem</span>
            </div>
            <TimeStamp />
          </Bubble>
        );

      case "poll":
        return (
          <Bubble>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
              <BarChart3 style={{ width: '13px', height: '13px', color: '#53bdeb' }} />
              <span style={{ fontSize: '10px', color: '#53bdeb', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Enquete</span>
            </div>
            <p style={{ fontSize: '14.2px', color: '#e9edef', fontWeight: 500, marginBottom: '8px' }}>{pollName}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {(pollOptions || []).filter(o => o.trim()).map((opt, i) => (
                <div key={i} style={{ borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', padding: '6px 10px', textAlign: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#53bdeb' }}>{opt}</span>
                </div>
              ))}
            </div>
            <TimeStamp />
          </Bubble>
        );

      case "list":
        return (
          <Bubble>
            {listTitle && <p style={{ fontSize: '14.2px', color: '#e9edef', fontWeight: 500 }}>{listTitle}</p>}
            {listDescription && <p style={{ fontSize: '14.2px', color: '#e9edef', marginTop: '2px', whiteSpace: 'pre-wrap', lineHeight: '8px' }}>{listDescription}</p>}
            {listFooter && <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '6px' }}>{listFooter}</p>}
            <TimeStamp />
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '8px', paddingTop: '8px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
              <List style={{ width: '14px', height: '14px', color: '#53bdeb' }} />
              <span style={{ fontSize: '13px', color: '#53bdeb', fontWeight: 500 }}>{listButtonText || "Ver opções"}</span>
            </div>
          </Bubble>
        );

      default:
        return <EmptyState />;
    }
  };

  return (
    <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
      {/* WhatsApp top bar */}
      <div style={{ background: '#202c33', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#2a3942', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <User style={{ width: '16px', height: '16px', color: '#aebac1' }} />
        </div>
        <div>
          <p style={{ fontSize: '13px', color: '#e9edef', fontWeight: 500, lineHeight: 1.2 }}>Grupo</p>
          <p style={{ fontSize: '11px', color: '#8696a0', lineHeight: 1.2 }}>preview da mensagem</p>
        </div>
      </div>
      {/* Chat area */}
      <div
        style={{
          background: '#0b141a',
          padding: '12px 0',
          minHeight: '180px',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.015'%3E%3Ccircle cx='50' cy='50' r='3'/%3E%3Ccircle cx='150' cy='80' r='2'/%3E%3Ccircle cx='250' cy='30' r='2.5'/%3E%3Ccircle cx='350' cy='70' r='2'/%3E%3Ccircle cx='100' cy='150' r='2'/%3E%3Ccircle cx='200' cy='130' r='3'/%3E%3Ccircle cx='300' cy='160' r='2'/%3E%3Ccircle cx='50' cy='250' r='2.5'/%3E%3Ccircle cx='150' cy='220' r='2'/%3E%3Ccircle cx='250' cy='260' r='3'/%3E%3Ccircle cx='350' cy='230' r='2'/%3E%3Ccircle cx='100' cy='330' r='2'/%3E%3Ccircle cx='200' cy='350' r='2.5'/%3E%3Ccircle cx='300' cy='310' r='2'/%3E%3Ccircle cx='50' cy='370' r='3'/%3E%3Ccircle cx='350' cy='380' r='2'/%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        {hasContent() ? renderContent() : <EmptyState />}
      </div>
      {/* Bottom bar */}
      <div style={{ background: '#202c33', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ flex: 1, background: '#2a3942', borderRadius: '20px', padding: '7px 14px' }}>
          <span style={{ fontSize: '12px', color: '#8696a0' }}>Digite uma mensagem</span>
        </div>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Mic style={{ width: '16px', height: '16px', color: 'white' }} />
        </div>
      </div>
    </div>
  );
}
