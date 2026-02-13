import {
  Sparkles, FileText, Play, Mic, MapPin, User, BarChart3, List,
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
    <span className="inline-flex items-center gap-1 ml-2 float-right mt-1">
      <span className="text-[10px] text-[#ffffff99]">12:00</span>
      <CheckCheck className="h-3 w-3 text-[#53bdeb]" />
    </span>
  );
}

function BubbleWrapper({ children, noBubble = false }: { children: React.ReactNode; noBubble?: boolean }) {
  if (noBubble) {
    return <div className="flex justify-end">{children}</div>;
  }
  return (
    <div className="flex justify-end">
      <div className="relative bg-[#005c4b] rounded-lg rounded-tr-none max-w-[320px] shadow-md">
        {/* Tail */}
        <div
          className="absolute -top-0 -right-2 w-0 h-0"
          style={{ borderStyle: 'solid', borderWidth: '0 0 8px 8px', borderColor: 'transparent transparent transparent #005c4b' }}
        />
        <div className="p-2 px-2.5">{children}</div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full min-h-[120px]">
      <p className="text-[#ffffff55] text-sm text-center">Componha uma mensagem para ver o preview</p>
    </div>
  );
}


export function WhatsAppPreview(props: WhatsAppPreviewProps) {
  const {
    messageType, textContent, mediaUrl, caption, locName, locAddress,
    locLat, locLng, contactName, contactPhone, pollName, pollOptions,
    listTitle, listDescription, listButtonText, listFooter, listSections,
    aiPrompt,
  } = props;

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
          <BubbleWrapper>
            <div>
              <span className="text-[#e9edef] text-[13px] whitespace-pre-wrap break-words">{textContent}</span>
              <TimeStamp />
            </div>
          </BubbleWrapper>
        );

      case "ai":
        return (
          <BubbleWrapper>
            <div className="flex items-center gap-2 py-1">
              <Sparkles className="h-4 w-4 text-[#53bdeb] shrink-0" />
              <span className="text-[#e9edef] text-[13px] italic opacity-70">Texto gerado pela I.A.</span>
            </div>
            <p className="text-[#ffffff66] text-[11px] mt-1 border-t border-[#ffffff15] pt-1.5">
              Prompt: {aiPrompt}
            </p>
            <TimeStamp />
          </BubbleWrapper>
        );

      case "image":
        return (
          <BubbleWrapper>
            <div>
              <div className="rounded-md overflow-hidden mb-1 bg-[#ffffff10]">
                <img src={mediaUrl} alt="Preview" className="w-full max-h-[180px] object-cover" />
              </div>
              {caption && (
                <div>
                  <span className="text-[#e9edef] text-[13px] whitespace-pre-wrap">{caption}</span>
                  <span className="text-[#e9edef] text-[13px] whitespace-pre-wrap">{caption}</span>
                </div>
              )}
              <TimeStamp />
            </div>
          </BubbleWrapper>
        );

      case "video":
        return (
          <BubbleWrapper>
            <div>
              <div className="rounded-md overflow-hidden mb-1 bg-[#ffffff10] h-[120px] flex items-center justify-center relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#00000066]" />
                <div className="h-10 w-10 rounded-full bg-[#00000088] flex items-center justify-center z-10">
                  <Play className="h-5 w-5 text-white fill-white ml-0.5" />
                </div>
              </div>
              {caption && (
                <div>
                  <span className="text-[#e9edef] text-[13px] whitespace-pre-wrap">{caption}</span>
                </div>
              )}
              <TimeStamp />
            </div>
          </BubbleWrapper>
        );

      case "document":
        return (
          <BubbleWrapper>
            <div>
              <div className="flex items-center gap-2 bg-[#ffffff10] rounded-md p-2.5 mb-1">
                <File className="h-8 w-8 text-[#53bdeb] shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[#e9edef] text-[12px] font-medium truncate">{mediaUrl?.split("/").pop() || "documento"}</p>
                  <p className="text-[#ffffff66] text-[10px]">Documento</p>
                </div>
              </div>
              {caption && (
                <div>
                  <span className="text-[#e9edef] text-[13px] whitespace-pre-wrap">{caption}</span>
                </div>
              )}
              <TimeStamp />
            </div>
          </BubbleWrapper>
        );

      case "audio":
        return (
          <BubbleWrapper>
            <div className="flex items-center gap-2.5 py-1">
              <div className="h-9 w-9 rounded-full bg-[#00a884] flex items-center justify-center shrink-0">
                <Mic className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 space-y-1">
                {/* Fake waveform */}
                <div className="flex items-end gap-[2px] h-5">
                  {Array.from({ length: 28 }, (_, i) => {
                    const h = Math.sin(i * 0.7) * 12 + Math.random() * 6 + 4;
                    return <div key={i} className="w-[3px] rounded-full bg-[#ffffff55]" style={{ height: `${h}px` }} />;
                  })}
                </div>
                <p className="text-[10px] text-[#ffffff66]">0:12</p>
              </div>
            </div>
            <TimeStamp />
          </BubbleWrapper>
        );

      case "sticker":
        return (
          <BubbleWrapper noBubble>
            <div className="max-w-[160px]">
              <img src={mediaUrl} alt="Sticker" className="w-full h-auto" />
            </div>
          </BubbleWrapper>
        );

      case "location":
        return (
          <BubbleWrapper>
            <div>
              <div className="rounded-md overflow-hidden mb-1.5 bg-[#1a3a2a] h-[100px] flex items-center justify-center relative">
                <div className="absolute inset-0 opacity-30" style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 20px, #ffffff10 20px, #ffffff10 21px), repeating-linear-gradient(90deg, transparent, transparent 20px, #ffffff10 20px, #ffffff10 21px)' }} />
                <MapPin className="h-8 w-8 text-[#ff5252] z-10" />
              </div>
              {locName && <p className="text-[#e9edef] text-[13px] font-medium">{locName}</p>}
              {locAddress && <p className="text-[#ffffff88] text-[11px]">{locAddress}</p>}
              {!locName && !locAddress && <p className="text-[#ffffff88] text-[11px]">{locLat}, {locLng}</p>}
              <TimeStamp />
            </div>
          </BubbleWrapper>
        );

      case "contact":
        return (
          <BubbleWrapper>
            <div>
              <div className="flex items-center gap-2.5 pb-2 border-b border-[#ffffff15]">
                <div className="h-10 w-10 rounded-full bg-[#ffffff15] flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-[#aebac1]" />
                </div>
                <div>
                  <p className="text-[#e9edef] text-[13px] font-medium">{contactName}</p>
                  <p className="text-[#ffffff88] text-[11px]">{contactPhone}</p>
                </div>
              </div>
              <div className="pt-1.5 text-center">
                <p className="text-[#53bdeb] text-[13px] font-medium">Enviar mensagem</p>
              </div>
              <TimeStamp />
            </div>
          </BubbleWrapper>
        );

      case "poll":
        return (
          <BubbleWrapper>
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BarChart3 className="h-3.5 w-3.5 text-[#53bdeb]" />
                <span className="text-[10px] text-[#53bdeb] uppercase font-medium tracking-wider">Enquete</span>
              </div>
              <p className="text-[#e9edef] text-[14px] font-medium mb-2">{pollName}</p>
              <div className="space-y-1.5">
                {(pollOptions || []).filter(o => o.trim()).map((opt, i) => (
                  <div key={i} className="rounded-md border border-[#ffffff20] px-3 py-1.5 text-center">
                    <span className="text-[#53bdeb] text-[13px]">{opt}</span>
                  </div>
                ))}
              </div>
              <TimeStamp />
            </div>
          </BubbleWrapper>
        );

      case "list":
        return (
          <BubbleWrapper>
            <div>
              {listTitle && <p className="text-[#e9edef] text-[14px] font-medium">{listTitle}</p>}
              {listDescription && <p className="text-[#e9edef] text-[13px] mt-0.5 whitespace-pre-wrap">{listDescription}</p>}
              {listFooter && <p className="text-[#ffffff66] text-[11px] mt-1.5">{listFooter}</p>}
              <TimeStamp />
              <div className="border-t border-[#ffffff15] mt-2 pt-2 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <List className="h-3.5 w-3.5 text-[#53bdeb]" />
                  <span className="text-[#53bdeb] text-[13px] font-medium">{listButtonText || "Ver opções"}</span>
                </div>
              </div>
            </div>
          </BubbleWrapper>
        );

      default:
        return <EmptyState />;
    }
  };

  return (
    <div className="rounded-xl overflow-hidden border border-[#ffffff10]">
      {/* WhatsApp header bar */}
      <div className="bg-[#202c33] px-3 py-2 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-[#00a884]" />
        <span className="text-[11px] text-[#aebac1] font-medium">Preview</span>
      </div>
      {/* Chat area with wallpaper */}
      <div
        className="bg-[#0b141a] p-4 min-h-[140px] relative"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        {hasContent() ? renderContent() : <EmptyState />}
      </div>
    </div>
  );
}
