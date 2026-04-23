export type Post = {
  publicId: string;
  createdAt: string;
  username: string;
  body: string;
};
export type Feed = { posts: Post[] };
export type User = { username: string };
export type LeaderboardRow = { rank: number; name: string; banCount: number };
