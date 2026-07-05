import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml; charset=utf-8',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the forum base URL from environment or use default
    const forumBaseUrl = Deno.env.get('FORUM_BASE_URL') || 'https://prohub-nexus.lovable.app';

    // Sub-forum / category RSS branch
    const url = new URL(req.url);
    const forumSlug = url.searchParams.get('forum');
    const catSlug = url.searchParams.get('category');
    if (forumSlug) {
      const { data: sf } = await supabase.from('sub_forums').select('id,name,slug').eq('slug', forumSlug).maybeSingle();
      if (!sf) return new Response('Not found', { status: 404, headers: corsHeaders });
      let q: any = supabase.from('sub_forum_topics').select('id,title,content,created_at,user_id,category_id, profiles:user_id(username)').eq('sub_forum_id', sf.id).eq('is_hidden', false).order('created_at', { ascending: false }).limit(50);
      if (catSlug) {
        const { data: cat } = await supabase.from('sub_forum_categories').select('id').eq('sub_forum_id', sf.id).eq('slug', catSlug).maybeSingle();
        if (cat) q = q.eq('category_id', cat.id);
      }
      const { data: tps } = await q;
      const items = (tps || []).map((t: any) => {
        const link = `${forumBaseUrl}/f/${sf.slug}/t/${t.id}`;
        const author = t.profiles?.username || 'Аноним';
        const desc = (t.content || '').replace(/<[^>]*>/g, '').substring(0, 200) + '...';
        return `<item><title><![CDATA[${t.title}]]></title><link>${link}</link><guid>${link}</guid><description><![CDATA[${desc}]]></description><author><![CDATA[${author}]]></author><pubDate>${new Date(t.created_at).toUTCString()}</pubDate></item>`;
      }).join('');
      const feed = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${sf.name}${catSlug ? ` — ${catSlug}` : ''}</title><link>${forumBaseUrl}/f/${sf.slug}</link><description>RSS подфорума ${sf.name}</description><language>ru</language><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items}</channel></rss>`;
      return new Response(feed, { headers: corsHeaders, status: 200 });
    }

    // Optional filters for the main-forum feed:
    //   ?type=topics|resources|videos  (default: all)
    //   ?category=<slug>               (limits topics/resources to one category)
    //   ?forum=prohub|codeforum|flexdev (defaults to prohub only for the classic feed)
    const typeFilter = (url.searchParams.get('type') || '').toLowerCase();
    const catFilter = url.searchParams.get('category');
    const forumFilter = (url.searchParams.get('forum_id') || 'prohub').toLowerCase();

    // Resolve category id from slug when provided
    let categoryId: string | null = null;
    if (catFilter) {
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', catFilter)
        .maybeSingle();
      categoryId = cat?.id ?? null;
    }

    // Categories that belong to the requested forum (used to scope resources/topics)
    const { data: forumCats } = await supabase
      .from('categories')
      .select('id')
      .eq('forum_id', forumFilter);
    const forumCategoryIds = (forumCats || []).map((c: any) => c.id);

    // Fetch latest topics with user profiles and category info
    let topics: any[] = [];
    if (!typeFilter || typeFilter === 'topics') {
      let tq: any = supabase
        .from('topics')
        .select(`id, title, content, created_at, updated_at, views,
          profiles!topics_user_id_fkey (username),
          categories!topics_category_id_fkey (name, slug)`)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .limit(50);
      if (categoryId) tq = tq.eq('category_id', categoryId);
      else if (forumCategoryIds.length) tq = tq.in('category_id', forumCategoryIds);
      const { data: t, error: te } = await tq;
      if (te) console.error('topics error', te);
      topics = t || [];
    }

    // Fetch latest resources
    let resources: any[] = [];
    if (!typeFilter || typeFilter === 'resources') {
      let rq: any = supabase
        .from('resources')
        .select(`id, title, description, created_at, updated_at, resource_type, downloads, rating,
          profiles!resources_user_id_fkey (username)`)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .limit(50);
      // resources have their own forum_id column
      rq = rq.eq('forum_id', forumFilter);
      const { data: r, error: re } = await rq;
      if (re) console.error('resources error', re);
      resources = r || [];
    }

    // Fetch latest videos (only for prohub or when no forum filter is tight)
    let videos: any[] = [];
    if ((!typeFilter || typeFilter === 'videos') && forumFilter === 'prohub' && !categoryId) {
      const { data: v, error: ve } = await supabase
        .from('videos')
        .select(`id, title, description, created_at, updated_at, views, likes,
          profiles!videos_user_id_fkey (username)`)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .limit(50);
      if (ve) console.error('videos error', ve);
      videos = v || [];
    }

    // Combine all content items with type
    const allItems = [
      ...(topics || []).map(item => ({ ...item, type: 'topic' as const })),
      ...(resources || []).map(item => ({ ...item, type: 'resource' as const })),
      ...(videos || []).map(item => ({ ...item, type: 'video' as const })),
    ];

    // Sort by created_at descending and limit to 50 most recent
    allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const recentItems = allItems.slice(0, 50);

    // Generate RSS items
    const rssItems = recentItems.map(item => {
      const pubDate = new Date(item.created_at).toUTCString();
      const profiles = item.profiles as any;
      const username = (Array.isArray(profiles) ? profiles[0]?.username : profiles?.username) || 'Аноним';
      
      let itemUrl = '';
      let title = '';
      let description = '';
      let category = '';

      if (item.type === 'topic') {
        const categories = (item as any).categories as any;
        const categoryName = (Array.isArray(categories) ? categories[0]?.name : categories?.name) || 'Общее';
        
        itemUrl = `${forumBaseUrl}/topic/${item.id}`;
        title = (item as any).title;
        description = ((item as any).content || '')
          .replace(/<[^>]*>/g, '')
          .substring(0, 200) + '...';
        category = `Тема - ${categoryName}`;
      } else if (item.type === 'resource') {
        const resource = item as any;
        itemUrl = `${forumBaseUrl}/resource/${item.id}`;
        title = resource.title;
        description = (resource.description || '')
          .replace(/<[^>]*>/g, '')
          .substring(0, 200) + '...';
        category = `Ресурс - ${resource.resource_type}`;
      } else if (item.type === 'video') {
        const video = item as any;
        itemUrl = `${forumBaseUrl}/video/${item.id}`;
        title = video.title;
        description = (video.description || 'Видео')
          .replace(/<[^>]*>/g, '')
          .substring(0, 200) + '...';
        category = 'Видео';
      }

      return `
    <item>
      <title><![CDATA[${title}]]></title>
      <link>${itemUrl}</link>
      <guid isPermaLink="true">${itemUrl}</guid>
      <description><![CDATA[${description}]]></description>
      <category><![CDATA[${category}]]></category>
      <author><![CDATA[${username}]]></author>
      <pubDate>${pubDate}</pubDate>
    </item>`;
    }).join('');

    const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>ProHub Nexsus - Форум разработчиков</title>
    <link>${forumBaseUrl}/forum</link>
    <description>Сообщество разработчиков и профессионалов - последние темы, ресурсы и видео</description>
    <language>ru</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${forumBaseUrl}/rss" rel="self" type="application/rss+xml" />
    ${rssItems}
  </channel>
</rss>`;

    return new Response(rssFeed, {
      headers: corsHeaders,
      status: 200,
    });
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
