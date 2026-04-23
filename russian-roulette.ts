import { Feed, User } from "./types";
import { BAN_DURATION, COMMUNITY_ID, NOW, TIMER } from "./constants";
import {
  getHeaders,
  getLeaderboard,
  login,
  logout,
  mfetch,
  rollBan,
  updateLeaderboard,
} from "./utils";

// get csrf and sid
const headers = await getHeaders();

// log in to discuit
await login(headers);

// get posts from last $TIMER ms
const feed = await mfetch(
  `https://discuit.org/api/posts?limit=50&communityId=${COMMUNITY_ID}`,
).then(async (r) => {
  const feed: Feed = await r.json();
  if (!feed.posts) {
    console.log("No posts in feed.");
    process.exit();
  }
  return feed;
});
const posts = feed.posts.filter(
  (post) => new Date(post.createdAt) > new Date(NOW - TIMER),
);

// get leaderboard post
const rows = await getLeaderboard(headers);

let somethingHappened = false;
for (const post of posts) {
  await rollBan(headers, post, rows);
  somethingHappened = true;
}

if (somethingHappened) {
  updateLeaderboard(headers, rows);
}

// unban everyone banned more than $BAN_DURATION ago
const bannedUsers: User[] = await mfetch(
  `https://discuit.org/api/communities/${COMMUNITY_ID}/banned`,
  {
    headers,
  },
).then((r) => r.json());
for (const user of bannedUsers) {
  const post = feed.posts.find((post) => post.username === user.username);
  if (!post) continue;

  const createdAt = new Date(post.createdAt);
  const bannedAgo = new Date(NOW - BAN_DURATION);
  if (createdAt > bannedAgo) continue;

  await mfetch(`https://discuit.org/api/communities/${COMMUNITY_ID}/banned`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({
      username: user.username,
    }),
  });
  console.log(`Unbanned ${user.username}`);
  somethingHappened = true;
}

// log out of discuit
await logout(headers);

if (somethingHappened) {
  process.exit(2);
}
