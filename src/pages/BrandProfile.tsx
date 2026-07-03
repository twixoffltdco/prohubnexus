import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, ExternalLink, Eye, BadgeCheck, Loader2, Settings } from "lucide-react";
import { useActiveBrand } from "@/hooks/useActiveBrand";

interface Brand {
  id: string;
  owner_user_id: string;
  name: string;
  handle: string;
  description: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  website_url: string | null;
  link_label: string | null;
  is_verified: boolean;
  is_active: boolean;
  views: number;
  created_at: string;
}

export default function BrandProfile() {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<any>(null);
  const [brandTopics, setBrandTopics] = useState<any[]>([]);
  const [brandResources, setBrandResources] = useState<any[]>([]);
  const { setActiveBrandId, activeBrandId } = useActiveBrand();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setMe(session?.user || null);
      const { data, error } = await supabase
        .from("brand_accounts")
        .select("*")
        .eq("handle", (handle || "").toLowerCase())
        .maybeSingle();
      if (error || !data) {
        setLoading(false);
        return;
      }
      setBrand(data as Brand);
      setLoading(false);

      const [{ data: tps }, { data: rs }] = await Promise.all([
        (supabase.from("topics") as any).select("id,title,created_at,views").eq("author_brand_id", data.id).eq("is_hidden", false).order("created_at", { ascending: false }).limit(20),
        (supabase.from("resources") as any).select("id,title,description,created_at,downloads,rating").eq("author_brand_id", data.id).eq("is_hidden", false).order("created_at", { ascending: false }).limit(20),
      ]);
      setBrandTopics(tps || []);
      setBrandResources(rs || []);

      // Increment views (throttled)
      let viewerKey = localStorage.getItem("viewer_key");
      if (!viewerKey) {
        viewerKey = crypto.randomUUID();
        localStorage.setItem("viewer_key", viewerKey);
      }
      supabase.rpc("increment_brand_views" as any, { _brand_id: data.id, _viewer_key: viewerKey });
    })();
  }, [handle]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={me} />
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={me} />
        <div className="container mx-auto px-4 py-16 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h1 className="text-2xl font-bold">Бренд не найден</h1>
          <p className="text-muted-foreground mt-2">Аккаунт бренда @{handle} не существует или был удалён.</p>
          <Button asChild className="mt-6"><Link to="/business">Узнать о бренд-аккаунтах</Link></Button>
        </div>
      </div>
    );
  }

  const isOwner = me?.id === brand.owner_user_id;

  return (
    <div className="min-h-screen bg-background">
      <Header user={me} />
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <Card className="overflow-hidden">
          {brand.cover_url ? (
            <div className="h-40 sm:h-56 bg-cover bg-center" style={{ backgroundImage: `url(${brand.cover_url})` }} />
          ) : (
            <div className="h-40 sm:h-56 bg-gradient-to-br from-primary/20 to-primary/5" />
          )}
          <CardContent className="pt-0">
            <div className="flex flex-col sm:flex-row gap-4 -mt-12 sm:-mt-14 relative">
              <Avatar className="h-24 w-24 sm:h-28 sm:w-28 border-4 border-background">
                <AvatarImage src={brand.avatar_url || undefined} />
                <AvatarFallback>{brand.name[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 sm:pt-14">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold">{brand.name}</h1>
                  {brand.is_verified && (
                    <Badge className="gap-1"><BadgeCheck className="h-3 w-3" /> Verified</Badge>
                  )}
                  <Badge variant="secondary" className="gap-1"><Building2 className="h-3 w-3" /> Бренд</Badge>
                </div>
                <p className="text-sm text-muted-foreground">@{brand.handle}</p>
                {brand.description && <p className="mt-3 text-sm">{brand.description}</p>}
                {brand.bio && <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">{brand.bio}</p>}

                <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground flex-wrap">
                  <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" /> {brand.views} просмотров</span>
                  <span>С нами с {new Date(brand.created_at).toLocaleDateString("ru-RU")}</span>
                </div>

                {brand.website_url && (
                  <a href={brand.website_url} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-3">
                    <ExternalLink className="h-3.5 w-3.5" />
                    {brand.link_label || brand.website_url}
                  </a>
                )}

                <div className="flex flex-wrap gap-2 mt-4">
                  {isOwner && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => navigate("/brands")}>
                        <Settings className="h-4 w-4 mr-1" /> Редактировать
                      </Button>
                      <Button
                        size="sm"
                        variant={activeBrandId === brand.id ? "secondary" : "default"}
                        onClick={() => setActiveBrandId(activeBrandId === brand.id ? null : brand.id)}
                      >
                        {activeBrandId === brand.id ? "Активен" : "Сделать активным"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 mt-6">
          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><Building2 className="h-4 w-4" /> Темы от бренда</h2>
              {brandTopics.length === 0 ? (
                <p className="text-sm text-muted-foreground">Пока нет тем, опубликованных от лица бренда.</p>
              ) : (
                <ul className="space-y-2">
                  {brandTopics.map((t) => (
                    <li key={t.id}>
                      <Link to={`/topic/${t.id}`} className="text-sm hover:underline block truncate">{t.title}</Link>
                      <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString("ru-RU")} · {t.views ?? 0} просмотров</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><Building2 className="h-4 w-4" /> Ресурсы от бренда</h2>
              {brandResources.length === 0 ? (
                <p className="text-sm text-muted-foreground">Пока нет ресурсов от бренда.</p>
              ) : (
                <ul className="space-y-2">
                  {brandResources.map((r) => (
                    <li key={r.id}>
                      <Link to={`/resource/${r.id}`} className="text-sm hover:underline block truncate">{r.title}</Link>
                      <div className="text-xs text-muted-foreground">★ {(r.rating || 0).toFixed(1)} · {r.downloads || 0} загрузок</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Бренд-аккаунт. Никнейм не сбрасывается. <Link to="/business" className="text-primary hover:underline">Узнать больше →</Link>
        </p>
      </main>
    </div>
  );
}
