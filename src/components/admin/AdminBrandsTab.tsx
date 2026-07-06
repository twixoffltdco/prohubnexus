import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { BadgeCheck, Building2, Loader2, Search } from "lucide-react";

export default function AdminBrandsTab() {
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("brand_accounts")
      .select("id,name,handle,avatar_url,is_verified,is_active,views,owner_user_id,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    setBrands(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (id: string, field: "is_verified" | "is_active", value: boolean) => {
    setSaving(id + field);
    const { error } = await supabase.from("brand_accounts").update({ [field]: value }).eq("id", id);
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      toast({ title: field === "is_verified" ? (value ? "Бренд верифицирован" : "Верификация снята") : (value ? "Активирован" : "Деактивирован") });
      setBrands(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
    }
    setSaving(null);
  };

  const filtered = brands.filter(b => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return b.name.toLowerCase().includes(q) || b.handle.toLowerCase().includes(q);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Бренд-аккаунты</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск по названию или @handle" className="pl-8" />
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Нет брендов</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(b => (
              <div key={b.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={b.avatar_url || undefined} />
                  <AvatarFallback>{b.name[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a href={`/brand/${b.handle}`} className="font-semibold hover:underline">{b.name}</a>
                    {b.is_verified && <Badge className="gap-0.5 text-[10px] h-5"><BadgeCheck className="h-3 w-3" /> Verified</Badge>}
                    {!b.is_active && <Badge variant="destructive" className="text-[10px] h-5">Неактивен</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">@{b.handle} · {b.views || 0} просмотров</div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <span>Verified</span>
                    <Switch checked={b.is_verified} disabled={saving === b.id + "is_verified"} onCheckedChange={v => toggle(b.id, "is_verified", v)} />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <span>Активен</span>
                    <Switch checked={b.is_active} disabled={saving === b.id + "is_active"} onCheckedChange={v => toggle(b.id, "is_active", v)} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
