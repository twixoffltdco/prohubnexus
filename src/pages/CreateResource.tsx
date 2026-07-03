import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { resourceSchema } from "@/lib/schemas";
import { Upload, Link2 } from "lucide-react";
import { use2FAGuard } from "@/hooks/use2FAGuard";
import { useActiveBrand } from "@/hooks/useActiveBrand";

const CreateResource = () => {
  const [user, setUser] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<"url" | "file">("url");
  const [resourceType, setResourceType] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const has2FA = await check2FA();
    if (!has2FA) return;

    // Validate with Zod
    const validation = resourceSchema.safeParse({
      title,
      description,
      resource_type: resourceType,
      url: uploadType === "url" ? url : "",
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
      let fileUrl = null;

      // Upload file if selected
      if (uploadType === "file" && file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('resource-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('resource-files')
          .getPublicUrl(filePath);

        fileUrl = publicUrl;
      }

      // Server-side moderation
      const { data: { session } } = await supabase.auth.getSession();
      const contentToModerate = `${title} ${description}`;
      
      const { data: moderationResult, error: moderationError } = await supabase.functions.invoke(
        'moderate-content',
        {
          body: { content: contentToModerate, type: 'resource' },
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

      const { error } = await supabase
        .from("resources")
        .insert({
          user_id: user.id,
          title,
          description,
          url: uploadType === "url" ? url : null,
          file_url: fileUrl,
          resource_type: resourceType,
        });

      if (error) throw error;

      // Check achievements
      await supabase.rpc("check_and_award_achievements", {
        _user_id: user.id,
      });

      toast({
        title: "Ресурс добавлен",
        description: "Ваш ресурс успешно опубликован",
      });

      navigate("/resources");
    } catch (error: any) {
      toast({
        title: "Ошибка добавления ресурса",
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
            <CardTitle className="text-2xl">Добавить ресурс</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="type">Тип ресурса</Label>
                <Select value={resourceType} onValueChange={setResourceType} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите тип" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="code">Исходный код</SelectItem>
                    <SelectItem value="tutorial">Туториал</SelectItem>
                    <SelectItem value="tool">Инструмент</SelectItem>
                    <SelectItem value="library">Библиотека</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Название</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Название ресурса"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Подробное описание ресурса"
                  rows={6}
                  required
                />
              </div>

              <div className="space-y-4">
                <Label>Способ добавления</Label>
                <Tabs value={uploadType} onValueChange={(v) => setUploadType(v as "url" | "file")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="url">
                      <Link2 className="mr-2 h-4 w-4" />
                      Ссылка
                    </TabsTrigger>
                    <TabsTrigger value="file">
                      <Upload className="mr-2 h-4 w-4" />
                      Загрузить файл
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="url" className="space-y-2">
                    <Label htmlFor="url">Ссылка на ресурс</Label>
                    <Input
                      id="url"
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com/resource"
                      required={uploadType === "url"}
                    />
                  </TabsContent>
                  
                  <TabsContent value="file" className="space-y-2">
                    <Label htmlFor="file">Загрузить файл</Label>
                    <Input
                      id="file"
                      type="file"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      required={uploadType === "file"}
                      accept=".zip,.rar,.7z,.tar,.gz,.pdf,.doc,.docx,.txt,.md"
                    />
                    <p className="text-sm text-muted-foreground">
                      Поддерживаемые форматы: архивы, документы
                    </p>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="flex space-x-4">
                <Button type="submit" disabled={loading}>
                  {loading ? "Добавление..." : "Добавить ресурс"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/resources")}
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

export default CreateResource;