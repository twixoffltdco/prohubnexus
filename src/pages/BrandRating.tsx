import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, BadgeCheck, Eye, Loader2, TrendingUp } from "lucide-react";

interface RatedBrand {
  id: string;
  name: string;
  handle: string;
  avatar_url: string | null;
  is_verified: boolean;
  views: number;
  topics: number;
  posts: number;
  resources: number;
  score: number;
}

export default function BrandRating() {
  const [user, setUser] = useState<any>(null);
  const [items, setItems] = useState<RatedBrand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    (async () => {
      const { data: brands } = await supabase
        .from("brand_accounts")
        .select("id,name,handle,avatar_url,is_verified,views")
        .eq("is_active", true)
        .limit(200);
      const list = brands || [];
      const rated = await Promise.all(list.map(async (b: any) => {
        const [{ count: topics }, { count: posts }, { count: resources }] = await Promise.all([
          (supabase.from("topics") as any).select("id", { count: "exact", head: true }).eq("author_brand_id", b.id).eq("is_hidden", false),
          (supabase.from("posts") as any).select("id", { count: "exact", head: true }).eq("author_brand_id", b.id).eq("is_hidden", false),
          (supabase.from("resources") as any).select("id", { count: "exact", head: true }).eq("author_brand_id", b.id).eq("is_hidden", false),
        ]);
        const t = topics || 0, p = posts || 0, r = resources || 0;
        const score = t * 5 + p * 1 + r * 8 + Math.floor((b.views || 0) / 10) + (b.is_verified ? 25 : 0);
        return { ...b, topics: t, posts: p, resources: r, score } as RatedBrand;
      }));
      rated.sort((a, b) => b.score - a.score);
      setItems(rated);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />
      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-5">
        <div className="flex items-center gap-3">
          <Trophy className="h-7 w-7 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold">Рейтинг бренд-аккаунтов</h1>
            <p className="text-sm text-muted-foreground">Позиция определяется активностью: темы, ресурсы, посты и просмотры.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-16">Пока нет активных брендов.</p>
        ) : (
          <div className="space-y-2">
            {items.map((b, idx) => (
              <Card key={b.id} className="hover:border-primary/40 transition">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`w-8 text-center font-bold ${idx === 0 ? "text-yellow-500" : idx === 1 ? "text-slate-300" : idx === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                    #{idx + 1}
                  </div>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={b.avatar_url || undefined} />
                    <AvatarFallback>{b.name[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={`/brand/${b.handle}`} className="font-semibold hover:underline truncate">{b.name}</Link>
                      {b.is_verified && <Badge className="gap-0.5 text-[10px] h-5"><BadgeCheck className="h-3 w-3" /></Badge>}
                      <span className="text-xs text-muted-foreground">@{b.handle}</span>
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-3 mt-0.5">
                      <span>📝 {b.topics} тем</span>
                      <span>💬 {b.posts} постов</span>
                      <span>📦 {b.resources} ресурсов</span>
                      <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{b.views}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold inline-flex items-center gap-1 text-primary">
                      <TrendingUp className="h-4 w-4" />{b.score}
                    </div>
                    <div className="text-[10px] text-muted-foreground">рейтинг</div>
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
