import process from "node:process";

type Post = { createdAt: string; username: string };
type Feed = { posts: Post[] };

const NOW = Date.now();
const DISCUIT_MOD_USERNAME = "ILostTheGame";
const DISCUIT_MOD_PASSWORD = process.env.DISCUIT_MOD_PASSWORD;
const TIMER = 20 * 60 * 1000;
const BAN_DURATION = 48 * 60 * 60 * 1000;
const COMMUNITY_ID = "18a86774eed778f377e8eb05"; // RussianRoulette community id

// get csrf and sid
const headers: Record<string, string> = await fetch(
  "https://discuit.org/api/_initial",
).then(({ headers }) => ({
  Cookie:
    headers
      .getSetCookie()
      .find((c) => c.includes("SID="))
      ?.split(";")
      .find((c) => c.includes("SID=")) ?? "",
  "X-Csrf-Token": headers.get("csrf-token") || "",
}));

// log in to discuit
if (!DISCUIT_MOD_PASSWORD) {
  console.error("Discuit moderator password not set");
  process.exit(1);
}
await fetch("https://discuit.org/api/_login", {
  method: "POST",
  headers,
  body: JSON.stringify({
    username: DISCUIT_MOD_USERNAME,
    password: DISCUIT_MOD_PASSWORD,
  }),
}).then(async (res) => {
  if (!res.ok) {
    const error = await res.json();
    console.error(`Failed to log in: ${error.message}`);
    process.exit(1);
  }
});

// get posts from last $TIMER ms
const feed = await fetch(
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
if (posts.length == 0) {
  console.log(`No posts in the last ${TIMER}ms.`);
  process.exit();
}

for (const post of posts) {
  const random = Math.floor(Math.random() * 6);
  console.log(`Rolled a ${random}`);
  if (random == 1) {
    await fetch(`https://discuit.org/api/communities/${COMMUNITY_ID}/banned`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        username: post.username,
      }),
    }).then(async (r) => {
      if (!r.ok) {
        const error = await r.json();
        console.error(`Failed to ban ${post.username}: ${error.message}`);
        process.exit(1);
      }
    });
    console.log(`${post.username} has been banned for ${BAN_DURATION}ms`);
  } else {
    console.log(`${post.username} is safe today`);
  }
}

// unban everyone from more than 48 hours ago
const oldPosts = feed.posts.filter((post) => {
  const createdAt = new Date(post.createdAt);
  const bannedAgo = new Date(NOW - BAN_DURATION);
  const bannedAgoMinusTimer = new Date(NOW - TIMER - BAN_DURATION);
  return bannedAgoMinusTimer <= createdAt && createdAt <= bannedAgo;
});
for (const post of oldPosts) {
  await fetch(`https://discuit.org/api/communities/${COMMUNITY_ID}/banned`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({
      username: post.username,
    }),
  }).then(async (r) => {
    if (!r.ok) {
      const error = await r.json();
      console.error(`Failed to unban ${post.username}: ${error.message}`);
      process.exit(1);
    }
  });
  console.log(`Unbanned ${post.username}`);
}

// log out of discuit
await fetch("https://discuit.org/api/_login?action=logout", {
  method: "POST",
  headers,
}).then(async (r) => {
  if (!r.ok) {
    const error = await r.json();
    console.error(`Failed to log out: ${error.message}`);
    process.exit(1);
  }
});
