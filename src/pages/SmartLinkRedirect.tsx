import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function SmartLinkRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    const redirect = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/smart-link-redirect?slug=${encodeURIComponent(slug)}`
        );
        const json = await res.json();

        if (json.redirect_url) {
          window.location.href = json.redirect_url;
        } else {
          setError(json.error || "Link não encontrado");
        }
      } catch {
        setError("Erro ao processar redirecionamento");
      }
    };

    redirect();
  }, [slug]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {error ? (
          <>
            <p className="text-lg font-semibold text-foreground">Ops!</p>
            <p className="text-muted-foreground">{error}</p>
          </>
        ) : (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground text-sm">Redirecionando...</p>
          </>
        )}
      </div>
    </div>
  );
}
