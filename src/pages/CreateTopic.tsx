import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { topicSchema } from "@/lib/schemas";
import { use2FAGuard } from "@/hooks/use2FAGuard";
import BBCodeToolbar from "@/components/BBCodeToolbar";
import { useActiveBrand } from "@/hooks/useActiveBrand";

const CreateTopic = () => {
  const [user, setUser] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { check2FA } = use2FAGuard();
  const { activeBrandId } = useActiveBrand();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      }
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    loadCategories();
    const categoryParam = searchParams.get("category");
    if (categoryParam) {
      setSelectedCategory(categoryParam);
    }
  }, [searchParams]);

  const loadCategories = async () => {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("forum_id", "prohub")
      .order("order_position");
    setCategories(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Check 2FA before allowing topic creation
    const has2FA = await check2FA();
    if (!has2FA) return;

    // Validate with Zod
    const validation = topicSchema.safeParse({
      title,
      content,
      category_id: selectedCategory,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      toast({
        title: "Ошибка валидации",
        description: firstError.message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Server-side moderation
      const { data: { session } } = await supabase.auth.getSession();
      const contentToModerate = `${title} ${content}`;
      
      const { data: moderationResult, error: moderationError } = await supabase.functions.invoke(
        'moderate-content',
        {
          body: { content: contentToModerate, type: 'topic' },
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );

      if (moderationError) throw moderationError;

      if (!moderationResult.approved) {
        toast({
          title: "Неприемлемый контент",
          description: moderationResult.reason || "Контент не прошёл модерацию",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("topics")
        .insert({
          category_id: selectedCategory,
          user_id: user.id,
          title: title.trim(),
          content: content.trim(),
          author_brand_id: activeBrandId || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-update quest progress for topics
      await supabase.rpc("increment_quest_progress", {
        _user_id: user.id,
        _action_type: "topics",
      });

      // Check achievements
      await supabase.rpc("check_and_award_achievements", {
        _user_id: user.id,
      });

      toast({
        title: "Тема создана",
        description: "Ваша тема успешно опубликована",
      });

      navigate(`/topic/${data.id}`);
    } catch (error: any) {
      toast({
        title: "Ошибка создания темы",
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

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Создать новую тему</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="category">Раздел</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите раздел" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.icon} {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Заголовок темы</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="О чем вы хотите поговорить?"
                  required
                />
              </div>

              <div className="space-y-0">
                <Label htmlFor="content">Содержание</Label>
                <BBCodeToolbar
                  onInsert={(before, after) => {
                    const textarea = document.getElementById("content") as HTMLTextAreaElement;
                    if (!textarea) return;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const selected = content.substring(start, end);
                    const newContent = content.substring(0, start) + before + selected + after + content.substring(end);
                    setContent(newContent);
                    setTimeout(() => {
                      textarea.focus();
                      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
                    }, 0);
                  }}
                />
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Расскажите подробнее... Используйте BBCode для форматирования"
                  rows={10}
                  required
                  className="rounded-t-none"
                />
              </div>

              <div className="flex space-x-4">
                <Button type="submit" disabled={loading}>
                  {loading ? "Создание..." : "Создать тему"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/")}
                >
                  Отмена
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CreateTopic;