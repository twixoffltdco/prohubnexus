import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import FlexDevHeader from "@/components/FlexDevHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Package, TrendingUp, Users, ArrowRight, Rss } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import usePageBackground from "@/hooks/usePageBackground";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  topicCount: number;
  lastTopic?: { title: string; id: string; created_at: string; username: string } | null;
}
interface LatestTopic { id: string; title: string; created_at: string }
interface LatestResource { id: string; title: string; created_at: string }

const FLEXDEV_RSS = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rss-feed?forum=flexdev`;

const FlexDevPanel = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [topics, setTopics] = useState<LatestTopic[]>([]);
  const [resources, setResources] = useState<LatestResource[]>([]);
  const [stats, setStats] = useState({ users: 0, topics: 0, resources: 0 });
  usePageBackground("#0a0118");

  useEffect(() => {
    (async () => {
      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .eq("forum_id", "flexdev")
        .order("order_position");

      const catsWith = await Promise.all(
        (cats || []).map(async (c: any) => {
          const { count } = await supabase.from("topics").select("*", { count: "exact", head: true }).eq("category_id", c.id).eq("is_hidden", false);
          const { data: last } = await supabase
            .from("topics").select("id,title,created_at, profiles(username)")
            .eq("category_id", c.id).eq("is_hidden", false)
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          return {
            ...c,
            topicCount: count || 0,
            lastTopic: last ? { id: last.id, title: last.title, created_at: last.created_at, username: (last.profiles as any)?.username || "—" } : null,
          };
        })
      );
      setCategories(catsWith);

      const catIds = (cats || []).map((c: any) => c.id);
      const [tRes, rRes, uCnt] = await Promise.all([
        catIds.length ? supabase.from("topics").select("id,title,created_at").in("category_id", catIds).eq("is_hidden", false).order("created_at", { ascending: false }).limit(6) : Promise.resolve({ data: [] as LatestTopic[] } as any),
        supabase.from("resources").select("id,title,created_at").eq("forum_id", "flexdev" as any).eq("is_hidden", false).order("created_at", { ascending: false }).limit(6),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);
      setTopics((tRes.data as any) ?? []);
      setResources((rRes.data as any) ?? []);
      const topicsTotal = catsWith.reduce((s, c) => s + c.topicCount, 0);
      setStats({ users: uCnt.count ?? 0, topics: topicsTotal, resources: (rRes.data?.length ?? 0) });
    })();
  }, []);

  const copyRss = () => {
    navigator.clipboard.writeText(FLEXDEV_RSS);
    toast.success("RSS-ссылка FlexDev скопирована");
  };

  return (
    <div className="min-h-screen bg-[#0a0118] text-slate-100 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute -top-40 -left-40 h-[420px] w-[420px] rounded-full bg-fuchsia-600/20 blur-[120px]" />
        <div className="absolute top-40 -right-40 h-[420px] w-[420px] rounded-full bg-cyan-500/20 blur-[120px]" />
      </div>

      <FlexDevHeader />

      <div className="relative container mx-auto px-4 py-6 sm:py-10">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-white">FlexDev — сообщество разработчиков</h1>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="border-fuchsia-500/40 bg-fuchsia-500/5 text-fuchsia-200 hover:bg-fuchsia-500/15" onClick={copyRss}>
              <Rss className="h-3.5 w-3.5 mr-1" /> RSS
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: Users, n: stats.users, l: "Участников", grad: "from-fuchsia-500 to-pink-500" },
            { icon: MessageSquare, n: stats.topics, l: "Тем", grad: "from-cyan-500 to-blue-500" },
            { icon: Package, n: stats.resources, l: "Ресурсов", grad: "from-purple-500 to-fuchsia-500" },
          ].map((s) => (
            <Card key={s.l} className="bg-white/5 border-white/10 backdrop-blur-md p-4">
              <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white bg-gradient-to-r ${s.grad}`}>
                <s.icon className="h-3 w-3" /> {s.l}
              </div>
              <div className="mt-2 text-2xl font-bold text-white">{s.n}</div>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card className="bg-white/5 border-fuchsia-500/20 backdrop-blur-md p-4">
            <h2 className="font-bold text-white mb-3">Категории FlexDev</h2>
            {categories.length === 0 ? (
              <p className="text-sm text-slate-400">Категории с forum_id=flexdev ещё не созданы.</p>
            ) : (
              <div className="space-y-1">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/flexdev/category/${c.slug}`)}
                    className="w-full text-left rounded-lg border border-white/5 bg-white/[0.02] px-3 py-3 hover:border-fuchsia-500/40 hover:bg-fuchsia-500/5 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{c.icon || "💜"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-fuchsia-300 font-semibold truncate">{c.name}</div>
                        <div className="text-xs text-slate-500 truncate">{c.description}</div>
                      </div>
                      <div className="text-xs text-slate-400 whitespace-nowrap">{c.topicCount} тем</div>
                    </div>
                    {c.lastTopic && (
                      <div className="mt-1 text-[11px] text-slate-500 ml-11 truncate">
                        {c.lastTopic.username} · {formatDistanceToNow(new Date(c.lastTopic.created_at), { addSuffix: true, locale: ru })}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </Card>

          <aside className="space-y-4">
            <Card className="bg-white/5 border-fuchsia-500/20 backdrop-blur-md p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2 font-bold text-white text-sm">
                  <TrendingUp className="h-4 w-4 text-fuchsia-300" /> Свежие темы
                </h2>
              </div>
              {topics.length === 0 && <p className="text-sm text-slate-500">Пока пусто.</p>}
              <div className="space-y-2">
                {topics.map((t) => (
                  <button key={t.id} onClick={() => navigate(`/flexdev/topic/${t.id}`)}
                    className="w-full text-left rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 hover:border-fuchsia-500/30 hover:bg-fuchsia-500/5">
                    <div className="text-sm text-slate-100 line-clamp-1">{t.title}</div>
                    <div className="text-[11px] text-slate-500">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: ru })}</div>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="bg-white/5 border-cyan-500/20 backdrop-blur-md p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2 font-bold text-white text-sm">
                  <Package className="h-4 w-4 text-cyan-300" /> Свежие ресурсы
                </h2>
                <Button size="sm" variant="ghost" className="text-cyan-300 hover:text-white hover:bg-cyan-500/10 h-7" onClick={() => navigate("/flexdev/resources")}>
                  Все <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
              {resources.length === 0 && <p className="text-sm text-slate-500">Пока пусто.</p>}
              <div className="space-y-2">
                {resources.map((r) => (
                  <button key={r.id} onClick={() => navigate(`/flexdev/resource/${r.id}`)}
                    className="w-full text-left rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 hover:border-cyan-500/30 hover:bg-cyan-500/5">
                    <div className="text-sm text-slate-100 line-clamp-1">{r.title}</div>
                    <div className="text-[11px] text-slate-500">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ru })}</div>
                  </button>
                ))}
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default FlexDevPanel;
