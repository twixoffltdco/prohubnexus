import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, BadgeCheck, Eye, Search, Loader2 } from "lucide-react";

interface Brand {
  id: string;
  name: string;
  handle: string;
  description: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  is_verified: boolean;
  is_active: boolean;
  views: number;
  created_at: string;
}

type Filter = "all" | "verified" | "popular" | "new";

export default function BrandDirectory() {
  const [user, setUser] = useState<any>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    (async () => {
      const { data } = await supabase
        .from("brand_accounts")
        .select("id,name,handle,description,avatar_url,cover_url,is_verified,is_active,views,created_at")
        .eq("is_active", true)
        .order("views", { ascending: false })
        .limit(200);
      setBrands((data as Brand[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = brands;
    const q = query.trim().toLowerCase();
    if (q) list = list.filter(b => b.name.toLowerCase().includes(q) || b.handle.toLowerCase().includes(q) || (b.description || "").toLowerCase().includes(q));
    if (filter === "verified") list = list.filter(b => b.is_verified);
    if (filter === "popular") list = [...list].sort((a, b) => b.views - a.views);
    if (filter === "new") list = [...list].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return list;
  }, [brands, query, filter]);

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />
      <main className="container mx-auto px-4 py-6 max-w-5xl space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <Building2 className="h-7 w-7 text-primary" />
          <div className="flex-1 min-w-[220px]">
            <h1 className="text-2xl font-bold">Все бренд-аккаунты</h1>
            <p className="text-sm text-muted-foreground">Каталог активных брендов на платформе — {filtered.length} из {brands.length}.</p>
          </div>
          <Button asChild variant="outline" size="sm"><Link to="/brands">Мои бренды</Link></Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по имени, handle или описанию" className="pl-8" />
          </div>
          <div className="flex gap-1 flex-wrap">
            {(["all", "verified", "popular", "new"] as Filter[]).map(f => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
                {f === "all" ? "Все" : f === "verified" ? "Verified" : f === "popular" ? "Популярные" : "Новые"}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-16">Ничего не найдено</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map(b => (
              <Card key={b.id} className="overflow-hidden hover:border-primary/40 transition">
                {b.cover_url ? (
                  <div className="h-20 bg-cover bg-center" style={{ backgroundImage: `url(${b.cover_url})` }} />
                ) : (
                  <div className="h-20 bg-gradient-to-br from-primary/20 to-primary/5" />
                )}
                <CardContent className="pt-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12 -mt-8 border-4 border-background">
                      <AvatarImage src={b.avatar_url || undefined} />
                      <AvatarFallback>{b.name[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/brand/${b.handle}`} className="font-semibold hover:underline truncate">{b.name}</Link>
                        {b.is_verified && <Badge className="gap-0.5 text-[10px] h-5"><BadgeCheck className="h-3 w-3" /> Verified</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">@{b.handle}</div>
                      {b.description && <p className="text-sm mt-1 line-clamp-2">{b.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {b.views}</span>
                        <span>с {new Date(b.created_at).toLocaleDateString("ru-RU")}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
