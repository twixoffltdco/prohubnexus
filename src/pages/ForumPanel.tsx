import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import AdDisplay from "@/components/AdDisplay";
import ForumStats from "@/components/ForumStats";
import BackupDomainsBanner from "@/components/BackupDomainsBanner";
import TemplateRenderer from "@/components/TemplateRenderer";
import PluginRunner from "@/components/PluginRunner";
import SeasonalCountdown from "@/components/SeasonalCountdown";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RSSFeed from "@/components/RSSFeed";
import { MessageSquare, Eye, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/useNotifications";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  topicCount?: number;
}

interface LatestTopic {
  id: string;
  title: string;
}

interface LatestResource {
  id: string;
  title: string;
}

const Forum = () => {
  const [user, setUser] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [latestTopics, setLatestTopics] = useState<LatestTopic[]>([]);
  const [latestResources, setLatestResources] = useState<LatestResource[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Enable real-time notifications
  useNotifications(user?.id);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("*")
        .eq("forum_id", "prohub")
        .order("order_position");

      if (categoriesError) throw categoriesError;

      const categoriesWithCounts = await Promise.all(
        (categoriesData || []).map(async (category) => {
          const { count } = await supabase
            .from("topics")
            .select("*", { count: "exact", head: true })
            .eq("category_id", category.id)
            .eq("is_hidden", false);

          return {
            ...category,
            topicCount: count || 0,
          };
        })
      );

      setCategories(categoriesWithCounts);

      const prohubCategoryIds = (categoriesData || []).map((category) => category.id);

      const [{ data: latestTopicsData }, { data: latestResourcesData }] = await Promise.all([
        prohubCategoryIds.length > 0
          ? supabase
              .from("topics")
              .select("id, title")
              .in("category_id", prohubCategoryIds)
              .eq("is_hidden", false)
              .order("created_at", { ascending: false })
              .limit(5)
          : Promise.resolve({ data: [] as LatestTopic[] }),
        supabase
          .from("resources")
          .select("id, title")
          .eq("is_hidden", false)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      setLatestTopics((latestTopicsData as LatestTopic[]) || []);
      setLatestResources((latestResourcesData as LatestResource[]) || []);
    } catch (error: any) {
      toast({
        title: "Ошибка загрузки",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />
      <BackupDomainsBanner />
      <PluginRunner hookPoint="forum_top" />
      <TemplateRenderer templateType="widget" />

      <main className="container mx-auto px-4 py-8">
        <SeasonalCountdown />
        <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold mb-1 md:mb-2">ProHub Форум</h1>
            <p className="text-sm md:text-base text-muted-foreground">Сообщество разработчиков и профессионалов</p>
          </div>
          <div className="flex gap-2">
            {user && (
              <>
                <Button onClick={() => navigate("/create-ad")} variant="outline" size="sm" className="text-xs md:text-sm">
                  Создать рекламу
                </Button>
                <Button onClick={() => navigate("/create-topic")} size="sm" className="text-xs md:text-sm">
                  <Plus className="mr-1 md:mr-2 h-4 w-4" />
                  Создать тему
                </Button>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Загрузка...</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              {categories.map((category) => (
                <Card
                  key={category.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/category/${category.slug}`)}
                >
                  <CardHeader className="p-4 md:p-6">
                    <div className="flex items-start md:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 md:space-x-3">
                        <span className="text-2xl md:text-3xl">{category.icon}</span>
                        <div>
                          <CardTitle className="text-base md:text-xl">{category.name}</CardTitle>
                          <CardDescription className="text-xs md:text-sm">{category.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center text-xs md:text-sm text-muted-foreground">
                        <MessageSquare className="mr-1 h-3 w-3 md:h-4 md:w-4" />
                        {category.topicCount}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
            
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Что нового на ProHub</CardTitle>
                  <CardDescription className="text-xs">Последние темы и ресурсы</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Темы</p>
                    <div className="space-y-2">
                      {latestTopics.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Пока пусто</p>
                      ) : latestTopics.map((topic) => (
                        <button key={topic.id} onClick={() => navigate(`/topic/${topic.id}`)} className="block w-full text-left text-sm hover:text-primary">
                          {topic.title}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ресурсы</p>
                    <div className="space-y-2">
                      {latestResources.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Пока пусто</p>
                      ) : latestResources.map((resource) => (
                        <button key={resource.id} onClick={() => navigate(`/resource/${resource.id}`)} className="block w-full text-left text-sm hover:text-primary">
                          {resource.title}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Рекламный сервис</CardTitle>
                  <CardDescription className="text-xs">Создайте и запустите свою рекламу</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button onClick={() => navigate("/create-ad")} className="w-full" size="sm">
                    Создать кампанию
                  </Button>
                  <Button onClick={() => navigate("/ads-dashboard")} variant="outline" className="w-full" size="sm">
                    Мои кампании
                  </Button>
                  <Button onClick={() => navigate("/withdraw")} variant="outline" className="w-full" size="sm">
                    Вывод средств
                  </Button>
                </CardContent>
              </Card>
              <AdDisplay location="sidebar" interests={["forum", "programming"]} />
            </div>
          </div>
        )}

        <div className="mt-8">
          <ForumStats />
        </div>
        <PluginRunner hookPoint="forum_bottom" />
      </main>
    </div>
  );
};

export default Forum;