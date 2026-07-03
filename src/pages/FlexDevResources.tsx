import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, ExternalLink, Package, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import FlexDevHeader from "@/components/FlexDevHeader";
import StyledUsername from "@/components/StyledUsername";
import BannedUserInlineBadge from "@/components/BannedUserInlineBadge";

interface Resource {
  id: string;
  title: string;
  description: string;
  resource_type: string;
  url: string | null;
  file_url: string | null;
  downloads: number;
  rating: number;
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
    username_css: string | null;
  } | null;
}

const FlexDevResources = () => {
  const [user, setUser] = useState<any>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const loadResources = async () => {
      try {
        const { data } = await supabase
          .from("resources")
          .select("id, title, description, resource_type, url, file_url, downloads, rating, created_at, user_id, profiles(username, username_css)")
          .eq("forum_id", "flexdev" as any)
          .eq("is_hidden", false)
          .order("created_at", { ascending: false });

        setResources((data as Resource[]) || []);
      } finally {
        setLoading(false);
      }
    };

    loadResources();
  }, []);

  const filteredResources = useMemo(() => {
    if (typeFilter === "all") return resources;
    return resources.filter((resource) => resource.resource_type === typeFilter);
  }, [resources, typeFilter]);

  const resourceTypes = Array.from(new Set(resources.map((resource) => resource.resource_type).filter(Boolean)));

  return (
    <div className="min-h-screen bg-[#0a0118] text-gray-200">
      <FlexDevHeader />

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-white md:text-2xl">Ресурсы FlexDev</h1>
            <p className="text-sm text-gray-400">Инструменты и материалы FlexDev — только для этого форума.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded border border-[#2a1145] bg-[#120425] px-3 py-2 text-sm text-gray-200">
              <option value="all">Все типы</option>
              {resourceTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            {user && (
              <button onClick={() => navigate("/create-resource")} className="inline-flex items-center gap-2 rounded bg-fuchsia-600 px-4 py-2 text-sm text-white hover:bg-fuchsia-700">
                <Plus className="h-4 w-4" />
                Добавить ресурс
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="rounded-lg border border-[#2a1145] bg-[#120425] p-8 text-center text-gray-400">Загрузка ресурсов...</div>
        ) : filteredResources.length === 0 ? (
          <div className="rounded-lg border border-[#2a1145] bg-[#120425] p-8 text-center text-gray-400">Ресурсов пока нет</div>
        ) : (
          <div className="space-y-3">
            {filteredResources.map((resource) => (
              <div key={resource.id} className="rounded-lg border border-[#2a1145] bg-[#120425] p-4 hover:border-fuchsia-700/70">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate(`/flexdev/resource/${resource.id}`)}>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded bg-fuchsia-600/15 px-2 py-1 text-xs uppercase tracking-wide text-fuchsia-300">{resource.resource_type}</span>
                      <span className="text-xs text-gray-500">★ {(resource.rating || 0).toFixed(1)}</span>
                    </div>
                    <h2 className="truncate text-lg font-semibold text-white">{resource.title}</h2>
                    <p className="mt-2 line-clamp-2 text-sm text-gray-400">{resource.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                      {resource.profiles?.username && (
                        <StyledUsername
                          username={resource.profiles.username}
                          usernameCss={resource.profiles.username_css}
                          profilePath={`/flexdev/profile/${encodeURIComponent(resource.profiles.username)}`}
                          className="text-sm"
                        />
                      )}
                      <BannedUserInlineBadge userId={resource.user_id} />
                      <span>•</span>
                      <span>{resource.downloads || 0} загрузок</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => navigate(`/flexdev/resource/${resource.id}`)} className="inline-flex items-center gap-2 rounded border border-[#2a1145] px-3 py-2 text-sm text-gray-200 hover:border-fuchsia-500 hover:text-white">
                      <Package className="h-4 w-4" />
                      Открыть
                    </button>
                    <button onClick={() => window.open(resource.file_url || resource.url || `/flexdev/resource/${resource.id}`, "_blank")} className="inline-flex items-center gap-2 rounded border border-[#2a1145] px-3 py-2 text-sm text-gray-200 hover:border-fuchsia-500 hover:text-white">
                      {resource.file_url ? <Download className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                      {resource.file_url ? "Скачать" : "Перейти"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default FlexDevResources;