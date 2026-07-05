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
  title: "ProHub MCP (Admin)",
  version: "0.2.0",
  instructions:
    "Admin-only MCP tools for the ProHub platform (ProHub, Code Forum, FlexDev). All tools require the caller to hold the 'admin' role in this app. Non-admins will receive an authorization error.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchTopics, getTopic, listCategories, listResources, getMe, createPost],
});
