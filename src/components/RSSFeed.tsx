import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Rss, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface RSSFeedProps {
  forum?: "prohub" | "codeforum" | "flexdev";
  categorySlug?: string;
}

const RSSFeed = ({ forum = "prohub", categorySlug }: RSSFeedProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rss-feed`;

  const build = (extra: Record<string, string> = {}) => {
    const params = new URLSearchParams({ forum_id: forum, ...extra });
    if (categorySlug) params.set("category", categorySlug);
    return `${base}?${params.toString()}`;
  };

  const feeds = [
    { label: "Всё (темы + ресурсы + видео)", url: build() },
    { label: "Только темы", url: build({ type: "topics" }) },
    { label: "Только ресурсы", url: build({ type: "resources" }) },
    ...(forum === "prohub" && !categorySlug ? [{ label: "Только видео", url: build({ type: "videos" }) }] : []),
  ];

  const copy = (u: string) => {
    navigator.clipboard.writeText(u);
    toast({ title: "Скопировано", description: "Ссылка на RSS-ленту скопирована" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Rss className="h-4 w-4 mr-2" />
          RSS
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>RSS-ленты</DialogTitle>
          <DialogDescription>
            Подключите нужный фид к вашему сайту или ридеру. Обновляется автоматически.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {feeds.map((f) => (
            <div key={f.url} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{f.label}</p>
              <div className="flex gap-2">
                <Input value={f.url} readOnly className="text-xs" />
                <Button onClick={() => copy(f.url)} size="icon" variant="outline">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button onClick={() => window.open(f.url, "_blank")} size="icon" variant="outline">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RSSFeed;
