import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchTopics from "./tools/search-topics";
import getTopic from "./tools/get-topic";
import listCategories from "./tools/list-categories";
import listResources from "./tools/list-resources";
import getMe from "./tools/get-me";
import createPost from "./tools/create-post";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "prohub-mcp",
  title: "ProHub MCP",
  version: "0.1.0",
  instructions:
    "Tools for the ProHub platform (ProHub, Code Forum, FlexDev). Read topics, categories, and resources without auth; sign in to fetch your profile or reply in topics.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchTopics, getTopic, listCategories, listResources, getMe, createPost],
});
