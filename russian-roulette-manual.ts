import { Post } from "./types";
import {
  getHeaders,
  getLeaderboard,
  login,
  logout,
  mfetch,
  rollBan,
  updateLeaderboard,
} from "./utils";

const POST_ID = process.argv[2];

// get csrf and sid
const headers = await getHeaders();

// log in to discuit
await login(headers);

const rows = await getLeaderboard(headers);

// get post from id
const post: Post = await mfetch(`https://discuit.org/api/posts/${POST_ID}`, {
  headers,
}).then((r) => r.json());
await rollBan(headers, post, rows);

updateLeaderboard(headers, rows);

// log out of discuit
await logout(headers);
